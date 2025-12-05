import { authRouter } from "./router/auth";
import { noteRouter } from "./router/note";
import { therapyRouter } from "./router/therapy";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  note: noteRouter,
  therapy: therapyRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
