import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Create account — VoxReels",
};

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { topic } = await searchParams;
  return <AuthForm mode="register" topic={typeof topic === "string" ? topic : undefined} />;
}
