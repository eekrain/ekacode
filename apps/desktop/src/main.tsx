/* @refresh reload */
import { render } from "solid-js/web";
import "./assets/main.css";
import { registerDefaultPartComponents } from "./components/parts/register";
import { GlobalSDKProvider } from "./providers/global-sdk-provider";
import { GlobalSyncProvider } from "./providers/global-sync-provider";
import App from "./routes";

// Enable dark mode by default
document.documentElement.classList.add("dark");
registerDefaultPartComponents();

// Get server config from preload
const getServerConfig = async () => {
  try {
    const config = await window.ekacodeAPI.server.getConfig();
    return config;
  } catch (error) {
    console.error("Failed to get server config:", error);
    return { baseUrl: "http://127.0.0.1:3000", token: "" };
  }
};

const root = document.getElementById("root");

// Initialize app with server config
getServerConfig().then(config => {
  render(
    () => (
      <GlobalSDKProvider baseUrl={config.baseUrl} token={config.token}>
        <GlobalSyncProvider>
          <App />
        </GlobalSyncProvider>
      </GlobalSDKProvider>
    ),
    root!
  );
});
