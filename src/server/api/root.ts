import { userRouter } from "@/server/api/routers/user";
import { adminRouter } from "@/server/api/routers/admin";
import { organizationRouter } from "@/server/api/routers/organization";
import { campaignRouter } from "@/server/api/routers/competition";
import { interestListRouter } from "@/server/api/routers/interest-list";
import { clipperRouter } from "@/server/api/routers/clipper";
import { clientRouter } from "@/server/api/routers/client";
import { academyRouter } from "@/server/api/routers/academy";
import { blogRouter } from "@/server/api/routers/blog";
import { chatRouter } from "@/server/api/routers/chat";
import { clanRouter } from "@/server/api/routers/clan";
import { youtubeRouter } from "@/server/api/routers/youtube";
import { instagramRouter } from "@/server/api/routers/instagram";
import { tiktokRouter } from "@/server/api/routers/tiktok";
import { affiliateRouter } from "@/server/api/routers/affiliate";
import { commentsAnalysisRouter } from "@/server/api/routers/comments-analysis";
import { videoDownloadsRouter } from "@/server/api/routers/video-downloads";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  admin: adminRouter,
  user: userRouter,
  organization: organizationRouter,
  campaign: campaignRouter,
  interestList: interestListRouter,
  clipper: clipperRouter,
  customers: clientRouter,
  academy: academyRouter,
  blog: blogRouter,
  chat: chatRouter,
  clan: clanRouter,
  youtube: youtubeRouter,
  instagram: instagramRouter,
  tiktok: tiktokRouter,
  affiliate: affiliateRouter,
  commentsAnalysis: commentsAnalysisRouter,
  videoDownloads: videoDownloadsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
