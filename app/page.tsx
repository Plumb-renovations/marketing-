import { redirect } from "next/navigation";

// The app entry redirects into the operations board (middleware gates auth).
export default function Home() {
  redirect("/leads");
}
