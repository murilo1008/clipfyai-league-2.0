import { createUploadthing, type FileRouter } from "uploadthing/next";
import { currentUser } from "@clerk/nextjs/server";
 
const f = createUploadthing();
 
export const ourFileRouter = {
  // Rota para upload de imagens de capa de competições (1:1)
  competitionCover: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      const user = await currentUser();
 
      if (!user) throw new Error("Não autorizado");
 
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload completo para usuário:", metadata.userId);
      console.log("URL do arquivo:", file.url);
 
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Rota para upload de imagens de capa de módulos da Academia (9:16)
  moduleCover: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      const user = await currentUser();
 
      if (!user) throw new Error("Não autorizado");
 
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload de capa de módulo completo para usuário:", metadata.userId);
      console.log("URL do arquivo:", file.url);
 
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Rota para upload de imagens de capa de categorias do blog
  blogCategoryCover: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      const user = await currentUser();

      if (!user) throw new Error("Não autorizado");

      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload de capa de categoria do blog completo para usuário:", metadata.userId);
      console.log("URL do arquivo:", file.url);

      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Rota para upload de imagens de clãs (1:1)
  clanImage: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      const user = await currentUser();

      if (!user) throw new Error("Não autorizado");

      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload de imagem de clã completo para usuário:", metadata.userId);
      console.log("URL do arquivo:", file.url);

      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Rota para upload de vídeos brutos da biblioteca
  rawVideo: f({
    video: {
      maxFileSize: "1GB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      const user = await currentUser();

      if (!user) throw new Error("Não autorizado");

      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.url, name: file.name, size: file.size };
    }),

  // Rota para upload de comprovantes de PIX
  pixProof: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 1,
    },
    pdf: {
      maxFileSize: "8MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      const user = await currentUser();
 
      if (!user) throw new Error("Não autorizado");
 
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload de comprovante PIX completo para usuário:", metadata.userId);
      console.log("URL do arquivo:", file.url);
 
      return { uploadedBy: metadata.userId, url: file.url };
    }),
} satisfies FileRouter;
 
export type OurFileRouter = typeof ourFileRouter;

