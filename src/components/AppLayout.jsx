import Header from "./Header";
import Navbar from "./Navbar";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <>
      <Header></Header>
      <Navbar></Navbar>
      <Outlet></Outlet>
    </>
  );
}
