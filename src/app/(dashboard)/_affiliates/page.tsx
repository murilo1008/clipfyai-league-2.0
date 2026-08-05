/* ============================================================
   INDICAÇÕES (CLIPADOR) — DESATIVADA POR ENQUANTO
   ------------------------------------------------------------
   A pasta foi renomeada de `affiliates` para `_affiliates`: no
   App Router, diretório com underscore é "private folder" e fica
   FORA do roteamento. Ou seja, /affiliates não existe mais — nem
   digitando a URL direto. O código continua aqui, intacto.

   A entrada "Indicações" do menu do clipador também está
   comentada em src/config/navigation.ts.

   PARA REATIVAR:
   1. renomeie a pasta de `_affiliates` de volta para `affiliates`;
   2. descomente o corpo deste arquivo (abaixo);
   3. descomente o item do menu em src/config/navigation.ts.

   O backend segue de pé (affiliate.getMine / affiliate.createLink),
   então não há nada a refazer no servidor.
   ============================================================ */

// import { redirect } from "next/navigation";
//
// import { auth } from "@clerk/nextjs/server";
//
// import { db } from "@/server/db";
//
// import Affiliates from "./affiliates";
//
// export default async function AffiliatesPage() {
//   const { userId } = await auth();
//
//   if (!userId) {
//     redirect("/sign-in");
//   }
//
//   const user = await db.user.findUnique({
//     where: { id: userId },
//     select: { role: true },
//   });
//
//   if (user?.role !== "CLIPPER") {
//     redirect("/");
//   }
//
//   return <Affiliates />;
// }

export {}
