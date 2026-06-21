import { redirect } from "next/navigation";

// The app entry redirects into the Home dashboard (middleware gates auth).
export default function Home() {
  redirect("/home");
}
