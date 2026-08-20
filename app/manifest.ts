import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "둘의 하루",
    short_name: "둘의 하루",
    description: "우리 둘이 함께 쓰고 모으는 커플 가계부",
    start_url: "/",
    display: "standalone",
    background_color: "#fffdf9",
    theme_color: "#36a968",
    icons: [
      {
        src: "/chorong-mint-collar-no-charm-v2.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
