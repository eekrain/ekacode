/* @refresh reload */
import { render } from "solid-js/web";
import "./assets/main.css";
import App from "./routes";

// Enable dark mode by default
document.documentElement.classList.add("dark");

const root = document.getElementById("root");
render(() => <App />, root!);
