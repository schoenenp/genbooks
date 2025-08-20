import { createHash } from 'crypto';
import nodemailer from 'nodemailer';
import { env } from '@/env';

const ABC = 'ABCEFGHJKLNPQSTUVWXYZ'

export default function createOrderKey(orderNo:number, orderType = "M"){
    let randomKey = orderType.split("")[0]?.toLocaleUpperCase() ?? orderType

    for(let i = 0; i < 2; i++){
        const randomNumber = Math.floor(Math.random() * ABC.length)
        randomKey += ABC[randomNumber]
    }

    return `ORD-${randomKey}-${orderNo}`
}


export function createCancelKey(key: string, secret: string = process.env.CANCEL_SECRET ?? 'default-secret-key'): string {
    // Create a hash using SHA-256
    const hash = createHash('sha256');
    hash.update(key + secret);
    return hash.digest('hex');
}

export function verifyCancelKey(key: string, hash: string, secret: string = process.env.CANCEL_SECRET ?? 'default-secret-key'): boolean {
    // Verify the hash by recreating it
    const expectedHash = createCancelKey(key, secret);
    return hash === expectedHash;
}

export async function sendOrderVerification(to: string, subject: string, html: string)
{
  const transporter = nodemailer.createTransport({
    host:env.EMAIL_SERVER_HOST,
    port: 465,
    secure: true,
    auth:{
      user: env.EMAIL_SERVER_USER,
      pass: env.EMAIL_SERVER_PASSWORD
    }
  })
  const info = await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    bcc: [ env.SHOP_EMAIL ]
  })

  console.log('Message sent: %s', info.messageId);
  return info;
}