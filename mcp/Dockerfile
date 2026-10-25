# The public MCP server in its own image, beside the site's: Node and the data
# it reads, and nothing the site serves. Built from the repository root, since
# it reads the site's own files:
#
#   docker build -f mcp/Dockerfile -t quran-mcp .
#   docker run -p 8788:8788 quran-mcp        # then http://localhost:8788/mcp
#
# docker-compose.yml runs it next to the site and the site's nginx passes /mcp
# to it. See DOCKER.md.

FROM node:22-alpine AS data
WORKDIR /src
COPY public/data public/data
COPY public/surah public/surah
# The recordings' timings are all the server wants of public/surah; the pages go
RUN find public/surah -type f ! -name '*.timing.json' -delete \
 && rm -rf public/data/mushaf.json

FROM node:22-alpine
WORKDIR /app

# Packages first: they change least, so a data or code change reuses the layer
COPY mcp/package.json mcp/package-lock.json mcp/
RUN cd mcp && npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# What quran.js reads, at the paths it reads them from: the Arabic and the
# module that parses it, then the site's data
COPY data/quran-uthmani.txt data/
COPY scripts/surah-text.js scripts/
COPY --from=data /src/public public
COPY mcp/src mcp/src

USER node
# The heap is capped below the container's memory limit, so Node collects
# early instead of growing into it; the data it holds is about 30 MB.
ENV NODE_ENV=production MCP_HOST=0.0.0.0 MCP_PORT=8788 NODE_OPTIONS=--max-old-space-size=96
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:8788/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "mcp/src/server.js"]
