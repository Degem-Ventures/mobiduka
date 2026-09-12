"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

export default function ApiDocsPage() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || typeof window === "undefined") {
      return;
    }

    initializedRef.current = true;

    const renderSwagger = () => {
      const swaggerWindow = window as typeof window & {
        SwaggerUIBundle?: any;
        SwaggerUIStandalonePreset?: any;
        ui?: any;
      };

      if (!swaggerWindow.SwaggerUIBundle || !swaggerWindow.SwaggerUIStandalonePreset) {
        return;
      }

      swaggerWindow.ui = swaggerWindow.SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        docExpansion: "list",
        persistAuthorization: true,
        presets: [
          swaggerWindow.SwaggerUIBundle.presets.apis,
          swaggerWindow.SwaggerUIStandalonePreset,
        ],
        layout: "BaseLayout",
      });
    };

    renderSwagger();
    const intervalId = window.setInterval(() => {
      if ((window as any).SwaggerUIBundle) {
        renderSwagger();
        window.clearInterval(intervalId);
      }
    }, 150);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <main style={{ margin: 0, minHeight: "100vh", background: "#f4f6fb" }}>
      <Script
        src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"
        strategy="afterInteractive"
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            body { margin: 0; background: #f4f6fb; }
            #swagger-ui {
              max-width: 1500px;
              margin: 0 auto;
              padding: 24px;
            }
            .swagger-ui .topbar { background: #0d1b3d; }
          `,
        }}
      />

      <div id="swagger-ui" />
    </main>
  );
}
