import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { Naming } from "@/util/naming";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { getBase64, uploadData, type FileItem } from "@/util/upload/functions";
import { validatePDFUpload } from "@/util/pdf/functions";
import { handleBookPart } from "@/util/book/functions";
import {
  buildModuleFeedVisibilityWhere,
  buildModulePreviewVisibilityWhere,
} from "./module-visibility";

export const moduleRouter = createTRPCRouter({
  initPage: protectedProcedure.query(({ ctx }) => {
    const isPrivileged =
      ctx.session.user.role === "ADMIN" ||
      ctx.session.user.role === "STAFF" ||
      ctx.session.user.role === "MODERATOR";

    const modules =
      ctx.db.module.findMany({
        where: {
          deletedAt: null,
          ...(isPrivileged ? {} : { createdById: ctx.session.user.id }),
        },
        include: {
          type: true,
          files: true,
        },
      }) ?? [];

    const tags =
      ctx.db.tag.findMany({
        where: {
          status: {
            not: "UNRELEASED",
          },
        },
        select: {
          id: true,
          name: true,
          output: true,
        },
      }) ?? [];

    const types =
      ctx.db.moduleType.findMany({
        where: {
          name: {
            in: ["wochenplaner", "umschlag", "sonstige"],
          },
        },
      }) ?? [];

    return {
      modules,
      tags,
      types,
    };
  }),
  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        type: z.string(),
        moduleFile: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const { name, type, moduleFile } = input;
      const currentUser = await db.user.findUnique({
        where: {
          id: session.user.id,
        },
      });

      if (!currentUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const bookPart = handleBookPart(type);
      const { valid, message } = await validatePDFUpload(moduleFile, bookPart);

      if (!valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: message ?? "Invalid PDF upload",
        });
      }

      const files = [];
      let base64String = moduleFile;
      if (base64String.startsWith("data:")) {
        base64String = base64String.split(",")[1] ?? "";
      }

      const fileBuffer = Buffer.from(base64String, "base64");

      const daFile = {
        data: fileBuffer,
        name: Naming.file("pdf"),
      };

      files.push(daFile);

      let uploadedFile: FileItem[] = [];
      uploadedFile = await uploadData(files);

      const file = uploadedFile[0];
      if (!file) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "File upload failed",
        });
      }

      const customModuleType =
        (await db.moduleType.findFirst({
          where: {
            name: type,
          },
        })) ??
        (await db.moduleType.findFirst({
          where: {
            name: "sonstige",
          },
        }));

      if (!customModuleType) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Custom file type not allowed",
        });
      }

      return db.module.create({
        data: {
          name,
          part: handleBookPart(type),
          type: {
            connect: {
              id: customModuleType.id,
            },
          },
          theme: "custom",
          files: {
            create: file,
          },
          createdBy: {
            connect: {
              id: session.user.id,
            },
          },
          visible: "PRIVATE",
        },
      });
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(40),
        type: z.string(),
        file: z.string().optional(),
        tagIds: z.number().array().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, name, type, file: base64File, tagIds } = input;
      const existingModule = await ctx.db.module.findFirst({
        where: {
          id,
        },
        include: {
          type: true,
          files: true,
        },
      });

      if (!existingModule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Module not found" });
      }

      const isPrivileged =
        ctx.session.user.role === "ADMIN" ||
        ctx.session.user.role === "STAFF" ||
        ctx.session.user.role === "MODERATOR";

      if (!isPrivileged && existingModule.createdById !== ctx.session.user.id) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const existingType = await ctx.db.moduleType.findFirst({
        where: {
          name: type.toLocaleLowerCase(),
        },
      });

      function handleTypeConnection(insertType: string, moduleType: string) {
        if (insertType === moduleType) {
          return undefined;
        }
        if (existingType) {
          return {
            connect: { id: existingType.id },
          };
        }
        return {
          create: {
            name: insertType.toLocaleLowerCase(),
            minPages: 1,
          },
        };
      }

      const filesToDisconnect = [];
      const files = [];

      if (base64File && base64File !== "") {
        const existingFile = existingModule.files.find((f) =>
          f.name?.startsWith("DATEI-"),
        );
        if (existingFile) {
          filesToDisconnect.push({ id: existingFile.id });
        }
        const fileContent = getBase64(base64File);
        const fileBuffer = Buffer.from(fileContent, "base64");

        files.push({
          data: fileBuffer,
          name: Naming.file("pdf"),
          type,
        });
      }

      const uploadedFiles = await uploadData(files);
      const bookPart = handleBookPart(type);

      const updatedModule = await ctx.db.module.update({
        where: {
          id,
        },
        data: {
          name,
          theme: "custom",
          part: bookPart,
          type: handleTypeConnection(type, existingModule.type.name),
          allowedTags: {
            connect: tagIds?.map((id) => ({ id })),
          },
          files: {
            create: uploadedFiles.length >= 1 ? uploadedFiles : undefined,
            disconnect:
              filesToDisconnect.length >= 1 ? filesToDisconnect : undefined,
          },
        },
      });

      return updatedModule;
    }),
  getUserModules: protectedProcedure.query(async ({ ctx }) => {
    const { db, session } = ctx;

    const currentUser = await db.user.findUnique({
      where: {
        id: session.user.id,
      },
      include: {
        modules: {
          include: {
            type: true,
            files: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });
    if (!currentUser) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return currentUser.modules
      .filter((m) => m.deletedAt === null)
      .map((moduleItem) => {
        // Find thumbnail file
        const thumbnailFile = moduleItem.files.find((file) =>
          file.name?.startsWith("thumb_"),
        );
        const thumbnail = thumbnailFile
          ? `https://cdn.pirrot.de${thumbnailFile.src}`
          : "/default.png";

        return {
          id: moduleItem.id,
          name: moduleItem.name,
          type: moduleItem.type.name,
          theme: moduleItem.theme,
          part: moduleItem.part,
          thumbnail,
        };
      });
  }),
  getPreview: publicProcedure
    .input(
      z.object({
        mid: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const sessionUserId = ctx.session?.user.id;
      const foundModule = await ctx.db.module.findFirst({
        where: {
          id: input.mid,
          deletedAt: null,
          ...buildModulePreviewVisibilityWhere(sessionUserId),
        },
        include: {
          files: {
            select: {
              src: true,
              name: true,
            },
          },
        },
      });

      if (!foundModule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Module not found" });
      }

      const thumbnail = foundModule?.files.find((f) =>
        f.name?.startsWith("thumb_"),
      );
      return thumbnail?.src ?? "/default.png";
    }),
  getByTypes: publicProcedure
    .input(
      z.object({
        included: z.string().array(),
        excluded: z.string().array(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { included, excluded } = input;
      const { db } = ctx;
      const userId = ctx.session?.user.id;

      const foundModules = await db.module.findMany({
        where: {
          deletedAt: null,
          ...buildModuleFeedVisibilityWhere(userId),
          type: {
            name: {
              in: included.length > 0 ? included : undefined,
              notIn: excluded.length > 0 ? excluded : undefined,
            },
          },
        },
        include: {
          files: true,
          type: true,
        },
      });

      const moduleResponse = foundModules.map((module) => {
        const { id, name, theme, files, type } = module;

        const thumbnailFile = files.find((file) =>
          file.name?.startsWith("thumb_"),
        );
        const thumbnail = thumbnailFile
          ? `https://cdn.pirrot.de${thumbnailFile.src}`
          : "/default.png";

        return {
          id,
          name,
          theme,
          type: type.name,
          thumbnail,
        };
      });

      return moduleResponse;
    }),
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id } = input;
      const existingModule = await ctx.db.module.findFirst({
        where: { id, deletedAt: null },
        select: {
          id: true,
          createdById: true,
        },
      });

      if (!existingModule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Module not found" });
      }

      const isPrivileged =
        ctx.session.user.role === "ADMIN" ||
        ctx.session.user.role === "STAFF" ||
        ctx.session.user.role === "MODERATOR";

      if (!isPrivileged && existingModule.createdById !== ctx.session.user.id) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      return ctx.db.module.update({
        where: {
          id,
        },
        data: {
          deletedAt: new Date(),
        },
      });
    }),
});
