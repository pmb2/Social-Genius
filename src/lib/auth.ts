import { getServerSession } from "next-auth";
import { authOptions } from "../app/api/auth/[...nextauth]/route";
import { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next";

export async function auth(...args: [GetServerSidePropsContext["req"], GetServerSidePropsContext["res"]] | [NextApiRequest, NextApiResponse] | []) {
  const session = await getServerSession(...args, authOptions);
  console.log("Session object in auth():", session);
  return session;
}