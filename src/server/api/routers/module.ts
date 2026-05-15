import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { env } from "@/env";
import { Naming } from "@/util/naming";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { getBase64, uploadData, type FileItem } from "@/util/upload/functions";
import {
  isThumbnailFile,
  pickCoverImageFile,
  pickModulePdfFile,
} from "@/util/module-files";
import { validatePDFUpload } from "@/util/pdf/functions";
import { createCustomCoverPdf } from "@/util/pdf/custom-cover";
import { handleBookPart } from "@/util/book/functions";
import {
  buildModuleFeedVisibilityWhere,
  buildModulePreviewVisibilityWhere,
} from "./module-visibility";

const COVER_TYPE = "umschlag";
const CUSTOM_COVER_FILE_PREFIX = "file_custom_cover_";
const CUSTOM_COVER_THUMB_PREFIX = "thumb_custom_cover_";

function normalizeType(type: string): string {
  return type.toLocaleLowerCase();
}

function isCoverType(type: string): boolean {
  return normalizeType(type) === COVER_TYPE;
}

function getMimeTypeFromDataUrl(input: string): string | null {
  const match = /^data:([^;]+);base64,/i.exec(input);
  return match?.[1] ?? null;
}

function isImageUpload(input: string): boolean {
  const mimeType = getMimeTypeFromDataUrl(input);
  return mimeType?.startsWith("image/") ?? false;
}

function getUploadExtension(input: string): string {
  const mimeType = getMimeTypeFromDataUrl(input);
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      if (mimeType?.includes("jpeg") || mimeType?.includes("jpg")) {
        return "jpg";
      }
      return "pdf";
  }
}

function toModuleAssetSrc(src: string): string {
  return /^https?:\/\//i.test(src) ? src : `https://cdn.pirrot.de${src}`;
}

function getModuleThumbnailSrc(
  files: Array<{ name: string | null; src: string }>,
): string {
  const thumbnailFile = files.find((file) => file.name?.startsWith("thumb_"));
  const coverImageFile = pickCoverImageFile(files);
  const previewFile = thumbnailFile ?? coverImageFile;

  return previewFile ? toModuleAssetSrc(previewFile.src) : "/default.png";
}

async function getCustomCoverTemplateBytes(): Promise<Uint8Array> {
  if (!env.CUSTOM_COVER_TEMPLATE_URL) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Missing CUSTOM_COVER_TEMPLATE_URL for image-based custom cover modules",
    });
  }

  const response = await fetch(env.CUSTOM_COVER_TEMPLATE_URL);
  if (!response.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to fetch custom cover template: ${response.status}`,
    });
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function uploadModuleAsset(
  base64File: string,
  fileNamePrefix?: string,
): Promise<FileItem> {
  const fileBuffer = Buffer.from(getBase64(base64File), "base64");
  const extension = getUploadExtension(base64File);
  const uploadedFiles = await uploadData([
    {
      data: fileBuffer,
      name: `${fileNamePrefix ?? ""}${Naming.file(extension)}`,
    },
  ]);

  const uploadedFile = uploadedFiles[0];
  if (!uploadedFile) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "File upload failed",
    });
  }

  return uploadedFile;
}

async function uploadRawModuleAsset(
  fileBuffer: Buffer,
  extension: string,
  fileNamePrefix: string,
): Promise<FileItem> {
  const uploadedFiles = await uploadData([
    {
      data: fileBuffer,
      name: `${fileNamePrefix}${Naming.file(extension)}`,
    },
  ]);

  const uploadedFile = uploadedFiles[0];
  if (!uploadedFile) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "File upload failed",
    });
  }

  return uploadedFile;
}

async function createCustomCoverFiles(
  base64Image: string,
): Promise<FileItem[]> {
  const imageBuffer = Buffer.from(getBase64(base64Image), "base64");
  const coverPdfBytes = await createCustomCoverPdf(
    await getCustomCoverTemplateBytes(),
    imageBuffer,
  );

  return [
    await uploadRawModuleAsset(
      Buffer.from(coverPdfBytes),
      "pdf",
      CUSTOM_COVER_FILE_PREFIX,
    ),
    await uploadModuleAsset(base64Image, CUSTOM_COVER_THUMB_PREFIX),
  ];
}

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
        moduleFile: z.string().min(1),
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
      const filesToCreate: FileItem[] = [];
      const isImageBasedCover = isCoverType(type) && isImageUpload(moduleFile);

      if (isImageBasedCover) {
        filesToCreate.push(...(await createCustomCoverFiles(moduleFile)));
      } else {
        const { valid, message } = await validatePDFUpload(
          moduleFile,
          bookPart,
        );

        if (!valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: message ?? "Invalid PDF upload",
          });
        }

        filesToCreate.push(await uploadModuleAsset(moduleFile));
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
            create: filesToCreate,
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

      const filesToDisconnect: Array<{ id: string }> = [];
      const filesToCreate: FileItem[] = [];
      const existingPdfFile = pickModulePdfFile(existingModule.files);
      const existingCoverImageFile = pickCoverImageFile(existingModule.files);
      const existingThumbnailFiles =
        existingModule.files.filter(isThumbnailFile);
      const isImageBasedCover = Boolean(
        base64File && isCoverType(type) && isImageUpload(base64File),
      );

      if (!isCoverType(type) && existingCoverImageFile && !base64File) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Image-based cover modules need a replacement PDF before changing the module type",
        });
      }

      if (base64File && base64File !== "") {
        if (isImageBasedCover) {
          if (existingCoverImageFile) {
            filesToDisconnect.push({ id: existingCoverImageFile.id });
          }
          if (existingPdfFile) {
            filesToDisconnect.push({ id: existingPdfFile.id });
          }
          filesToDisconnect.push(
            ...existingThumbnailFiles.map((file) => ({ id: file.id })),
          );
          filesToCreate.push(...(await createCustomCoverFiles(base64File)));
        } else {
          if (existingPdfFile) {
            filesToDisconnect.push({ id: existingPdfFile.id });
          }
          if (existingCoverImageFile) {
            filesToDisconnect.push({ id: existingCoverImageFile.id });
          }
          filesToDisconnect.push(
            ...existingThumbnailFiles.map((file) => ({ id: file.id })),
          );
          filesToCreate.push(await uploadModuleAsset(base64File));
        }
      } else if (!isCoverType(type) && existingCoverImageFile) {
        filesToDisconnect.push({ id: existingCoverImageFile.id });
      }

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
            create: filesToCreate.length >= 1 ? filesToCreate : undefined,
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
        return {
          id: moduleItem.id,
          name: moduleItem.name,
          type: moduleItem.type.name,
          theme: moduleItem.theme,
          part: moduleItem.part,
          thumbnail: getModuleThumbnailSrc(moduleItem.files),
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

      const previewFile =
        foundModule.files.find((f) => f.name?.startsWith("thumb_")) ??
        pickCoverImageFile(foundModule.files);
      return previewFile?.src ?? "/default.png";
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

        return {
          id,
          name,
          theme,
          type: type.name,
          thumbnail: getModuleThumbnailSrc(files),
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
