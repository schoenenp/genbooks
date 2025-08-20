import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import createOrderKey, { sendOrderVerification, verifyCancelKey } from "@/util/order/functions";
import { decryptPayload, encryptPayload } from "@/util/crypto";
import { stripe } from "@/util/stripe";
import { createOrderConfirmationEmail } from "@/util/order/templates/create-validation-order";
import { env } from "@/env";

export const orderRouter = createTRPCRouter({

validate: publicProcedure
.input(z.object({
     session: z.string()
})).mutation(async ({ctx, input}) => {

    const retrievedSession = await stripe.checkout.sessions.retrieve(input.session)

    const existingBookOrder = await ctx.db.bookOrder.findFirst({
        where:{
            id: retrievedSession.metadata?.orderId
        },
        include:{
            payment: true
        }
    })

 if(!existingBookOrder){
    throw new Error("Keine Bestellung gefunden")
 }

 await ctx.db.bookOrder.update({
    where:{
        id: existingBookOrder.id
    },
    data:{
        payment:{
            update:{
                status: retrievedSession.payment_status === "unpaid" ? "PENDING" : "SUCCEEDED",
                total: retrievedSession.amount_total ?? 0,
                shippingCost: retrievedSession.shipping_cost?.amount_total ?? 0,
            }
        }
    }
 })
 
const createdOrder = await ctx.db.order.create({
    data: {
        user: ctx.session?.user ? {
            connect:{
                id: ctx.session?.user.id
            }
        }: undefined,
        bookOrder: {
            connect: {
                id: existingBookOrder.id
            }
        }
    }
})

const createdOrderKey = createOrderKey(createdOrder.id)

await ctx.db.order.update({
    where: {
        id: createdOrder.id
    },
    data: {
        orderKey: createdOrderKey
    }
})

const customerEmail = retrievedSession.customer_details?.email ?? env.SHOP_EMAIL
const customerName = retrievedSession.customer_details?.name ?? "Kunde"

const html = await createOrderConfirmationEmail(createdOrderKey, customerName);

try{
    await sendOrderVerification(
        customerEmail,
        'Bestellung bestätigt - Pirrot',
        html
    )
}catch(err){
    console.error('Failed to send email:', err);
}

const orderKey = encryptPayload({orderKey: createdOrderKey})
return orderKey
}),
cancelByUser:publicProcedure
.input(z.object({
    encryptedPayload: z.string(),
}))
.mutation(async ({ctx, input}) => {
    // Decrypt on server side
    const payload: { bookId: string; orderId: string; cancelKey:string;} = await decryptPayload(input.encryptedPayload)
    
    // Validate the payload
    if (!payload.orderId || !payload.cancelKey) {
        throw new Error("Invalid payload")
    }
    
    // Verify cancel key
    const validCancelKey = verifyCancelKey(payload.orderId, payload.cancelKey)
    if (!validCancelKey) {
        throw new Error("Invalid cancellation key")
    }
    
    // Check if order exists and is cancellable
    const bookOrder = await ctx.db.bookOrder.findFirst({
        where: {
            id: payload.orderId,
            orderId: null,
        }
    })
    
    if (!bookOrder) {
        throw new Error("Order not found or not cancellable")
    }

    await ctx.db.bookOrder.delete({
        where: { id: bookOrder.id }
    })

    return payload.bookId
}),
getById:protectedProcedure
.input(z.object({
    orderId: z.string()
}))
.query(async ({ctx, input}) => {
    const {db} = ctx
    const {orderId} = input
    const payload: { orderId: string }  = await decryptPayload(orderId)
    const order = await db.order.findUnique({
        where:{
            orderKey:payload.orderId
        },
        include:{
            shipping:true,
            bookOrder:{
               include:{
                book:true,
                payment:true
               } 
            }
        }
    })
    if(!order ){
        throw new Error("Keine Bestellung gefunden.")
    }

    let orderDetails
    let orderPrice = order?.bookOrder?.payment.total ?? 0
    let shippingPrice = order?.bookOrder?.payment.shippingCost ?? 0

    
    if(order.bookOrder?.payment.shopId){
        orderDetails = await stripe
            .checkout
            .sessions
            .retrieve(order.bookOrder?.payment.shopId)
        if(orderDetails.amount_total){
            orderPrice = orderDetails?.amount_total
        }
        if(orderDetails.shipping_cost?.amount_total){
            shippingPrice = orderDetails?.shipping_cost?.amount_total
        }
    }
        
    const booksPrice = order.bookOrder?.payment.price ?? 0
    const orderObject = {
        id:order.orderKey,
        name: order.bookOrder?.book.name ?? `Buch-${order.id}`,
        date: order.createdAt.toLocaleDateString() ?? "NO ORDER",
        status: order.status,
        price:`${(booksPrice / 100).toFixed(2)}€`,
        shipping:`${(shippingPrice / 100).toFixed(2)}€`,
        total: `${(orderPrice / 100).toFixed(2)}€`,
        trackingId: order.shippingId,
        paymentStatus: orderDetails?.payment_status === "paid" ? "Bezahlt": orderDetails?.payment_status === "no_payment_required" ? "Gratis" : "Wartend",
    }

    return orderObject ?? null
    }),
getByPublicId:publicProcedure
.input(z.object({
    orderId: z.string()
}))
.query(async ({ctx, input}) => {
    const {db} = ctx
    const {orderId} = input
    let payload: { orderKey: string }
    try{
        payload = await decryptPayload(orderId)
    }catch(err){
        throw new Error(`decrypting error: ${err as string}`)
    }
    if(!payload){
        throw new Error("No payload found...")
    }
    const order = await db.order.findUnique({
        where:{
            orderKey:payload.orderKey
        },
        include:{
            shipping:true,
            bookOrder:{
               include:{
                book:true,
                payment:true
               } 
            }
        }
    })
    if(!order ){
        throw new Error("Keine Bestellung gefunden.")
    }

    let orderDetails
    let orderPrice = order?.bookOrder?.payment.total ?? 0
    let shippingPrice = order?.bookOrder?.payment.shippingCost ?? 0

    
    if(order.bookOrder?.payment.shopId){
        orderDetails = await stripe
            .checkout
            .sessions
            .retrieve(order.bookOrder?.payment.shopId)
        if(orderDetails.amount_total){
            orderPrice = orderDetails?.amount_total
        }
        if(orderDetails.shipping_cost?.amount_total){
            shippingPrice = orderDetails?.shipping_cost?.amount_total
        }
    }

    if(!orderDetails){
        throw new Error("Keine Online Bezahlung gefunden.")
    }
    const invoiceId = orderDetails.invoice as string;
    const invoice = await stripe.invoices.retrieve(invoiceId);
    const invoiceUrl = invoice.hosted_invoice_url
    
    const booksPrice = order.bookOrder?.payment.price ?? 0
    const orderObject = {
        id:order.orderKey,
        name: order.bookOrder?.book.name ?? `Buch-${order.id}`,
        date: order.createdAt.toLocaleDateString() ?? "NO ORDER",
        status: order.status,
        price:`${(booksPrice / 100).toFixed(2)}€`,
        shipping:`${(shippingPrice / 100).toFixed(2)}€`,
        total: `${(orderPrice / 100).toFixed(2)}€`,
        trackingId: order.shippingId,
        invoiceUrl,
        paymentStatus: orderDetails?.payment_status === "paid" ? "SUCCEEDED" : 
        orderDetails?.payment_status === "no_payment_required" ? "SUCCEEDED" : 
        orderDetails?.payment_status === "unpaid" ? "PENDING" : 
        orderDetails?.payment_status === "canceled" ? "CANCELLED" : "PENDING",
    }

    return orderObject ?? null
    }),
  initSection: protectedProcedure
  .query(async ({ctx}) => {
    const {db} = ctx
    const all = await db.order.findMany({
        where:{
            userId: ctx.session.user.id,
        },
        include:{
            bookOrder:{
                include:{
                    book:true,
                    payment:true,
                }
            },
        },
            orderBy: {
                createdAt: "desc"
            },
            skip:1
        })
        let latest = []
         latest = await db.order.findMany({
            where:{
                userId: ctx.session.user.id,
            },
            include:{
                bookOrder:{
                    include:{
                        book:true,
                        payment:true,
                    }
                },
            },
                take:1,
                orderBy: {
                    createdAt: "desc"
                }
            })

            latest = latest.map( o => {
                const currentOrder = o.bookOrder
                const totalOrderPrice = currentOrder?.payment.total ?? 0
                return {
                    id: o.orderKey,
                    hash:encryptPayload({orderKey: o.orderKey}),
                    name: currentOrder?.book.name ?? `Buch-${o.id}`,
                    date: o?.createdAt.toLocaleDateString() ?? "NO ORDER",
                    status: o?.status ?? "FAILED",
                    total: `${(totalOrderPrice / 100).toFixed(2)}€`
                }})
                const latestOrder = latest[0]
        return {
            all:all.map( o => {
            const currentOrder = o.bookOrder
            const totalOrderPrice = currentOrder?.payment.total ?? 0

            return {
                id: o.orderKey,
                hash:encryptPayload({orderKey: o.orderKey}),
                name: currentOrder?.book.name ?? `Buch-${o.id}`,
                date: o?.createdAt.toLocaleDateString() ?? "NO ORDER",
                status: o?.status ?? "FAILED",
                total: `${(totalOrderPrice / 100).toFixed(2)}€`
            }}) ?? [],
            latest: latestOrder ?? null
        }
  }),
  cancelPending:publicProcedure
  .input(z.object({
    orderId: z.string()
  }))
  .mutation(async ({ctx, input}) => {
    const payload: {orderKey: string} = await decryptPayload(input.orderId)

    const order = await ctx.db.order.findUnique({
        where: {
          orderKey: payload.orderKey
        },
        include: {
          bookOrder: {
            include: {
              payment: true
            }
          }
        }
      })
  
      if (!order) {
        throw new Error("Order not found")
      }
  
      if (order.status === "CANCELED") {
        throw new Error("Order is already canceled")
      }
  
      // Handle Stripe refund if payment exists
      if (order.bookOrder?.payment.shopId) {
        try {
          // Get the payment intent from the session
          const session = await stripe.checkout.sessions.retrieve(order.bookOrder.payment.shopId)
          
          if (session.payment_intent) {
            // Create refund
            const refund = await stripe.refunds.create({
              payment_intent: session.payment_intent as string,
              reason: 'requested_by_customer'
            })
  
            // Update payment status
            await ctx.db.bookOrder.update({
              where: {
                id: order.bookOrder.id
              },
              data: {
                payment: {
                  update: {
                    status: "REFUNDED",
                    refundId: refund.id,
                    refundedAt: new Date()
                  }
                }
              }
            })
          }
        } catch (error) {
          console.error('Stripe refund error:', error)
          throw new Error("Failed to process refund")
        }
      }
      await ctx.db.payment.update({
        where:{
            id: order.bookOrder?.payment.id
        },
        data:{
            status:"REFUNDED"
        }
      })
      return ctx.db.order.update({
        where: {
          orderKey: payload.orderKey
        },
        data: {
          status: "CANCELED",
          canceledAt: new Date(),
        }
      })
  })
});
