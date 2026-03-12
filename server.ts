import express from "express";
import { createServer as createViteServer } from "vite";
import * as path from "path";
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qxoglhkfxxqsjefynzqn.supabase.co'; 
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4b2dsaGtmeHhxc2plZnluenFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzQwNTAsImV4cCI6MjA4NTYxMDA1MH0.gLvcHgY0rqLd26Nw61_M7nmjaz4TUsP9VL-XxN5wNSU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
  });

  console.log("Starting server initialization...");

  let vite: any;
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite in middleware mode...");
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware attached.");
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
  }

  // 健康檢查
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 處理所有請求
  app.get("*all", async (req, res, next) => {
    const url = req.originalUrl;

    // 如果是請求靜態資源（帶有副檔名），交給下一個處理器（Vite 或靜態服務）
    // 但排除活動詳情頁面，因為我們需要為其注入 OG 標籤
    if (url.includes('.') && !url.includes('/activity/')) {
      return next();
    }

    // 只處理 HTML 請求
    if (req.headers.accept && !req.headers.accept.includes('text/html')) {
      return next();
    }

    console.log(`Handling request for: ${url}`);

    try {
      let templatePath = process.env.NODE_ENV === "production" 
        ? path.resolve(process.cwd(), "dist", "index.html")
        : path.resolve(process.cwd(), "index.html");
      
      if (!fs.existsSync(templatePath)) {
        console.error(`Template not found at: ${templatePath}`);
        return res.status(404).send("Index template not found");
      }

      let template = fs.readFileSync(templatePath, "utf-8");

      if (process.env.NODE_ENV !== "production") {
        console.log("Transforming HTML with Vite...");
        template = await Promise.race([
          vite.transformIndexHtml(url, template),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Vite Transform Timeout")), 3000))
        ]) as string;
      }

      // 預設 OG 標籤
      let ogTitle = "長展分會活動報名";
      let ogDescription = "立即報名參加 BNI 長展分會的商務例會與精選活動。";
      let ogImage = "https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=1200&auto=format&fit=crop";
      let ogUrl = process.env.APP_URL || `https://${req.get('host')}${url}`;

      // 檢查是否為活動詳情頁面
      const activityMatch = url.match(/\/activity\/([^/]+)/);
      if (activityMatch) {
        const activityId = activityMatch[1];
        console.log(`Fetching activity data for ID: ${activityId}`);
        try {
          const { data: activity } = await Promise.race([
            supabase.from("activities").select("*").eq("id", activityId).single(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1500))
          ]) as any;

          if (activity) {
            ogTitle = `${activity.title} - 長展分會活動報名`;
            ogDescription = `${activity.date} ${activity.time} | 地點：${activity.location}`;
            ogImage = activity.picture || ogImage;
            ogUrl = process.env.APP_URL ? `${process.env.APP_URL}/activity/${activityId}` : `https://${req.get('host')}/activity/${activityId}`;
            console.log("Activity data fetched successfully.");
          }
        } catch (err) {
          console.warn("Failed to fetch activity data (timeout or error), using defaults.");
        }
      }

      const html = template
        .replace(/__OG_TITLE__/g, ogTitle)
        .replace(/__OG_DESCRIPTION__/g, ogDescription)
        .replace(/__OG_IMAGE__/g, ogImage)
        .replace(/__OG_URL__/g, ogUrl);

      res.status(200).set({ "Content-Type": "text/html" }).send(html);
    } catch (e: any) {
      console.error(`Error handling request: ${e.message}`);
      if (process.env.NODE_ENV !== "production") {
        vite.ssrFixStacktrace(e);
      }
      next(e);
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical error during server startup:", err);
});
