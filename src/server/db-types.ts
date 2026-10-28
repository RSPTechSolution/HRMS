import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export type DbTx = Prisma.TransactionClient;
export type Db = PrismaClient | DbTx;
