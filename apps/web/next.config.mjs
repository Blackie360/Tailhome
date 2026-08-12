/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/install.sh",
        headers: [
          {
            key: "Content-Type",
            value: "text/plain; charset=utf-8"
          },
          {
            key: "Content-Disposition",
            value: "inline"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
