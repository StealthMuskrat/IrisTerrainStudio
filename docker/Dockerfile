FROM node:24-alpine
WORKDIR /opt/iris-terrain-studio
COPY package.json upstream.lock.json ./
COPY apps ./apps
COPY packages ./packages
RUN mkdir -p /data/packs && chown -R node:node /data /opt/iris-terrain-studio
USER node
ENV HOST=0.0.0.0 PORT=4783 IRIS_PACKS_DIR=/data/packs
VOLUME ["/data/packs"]
EXPOSE 4783
CMD ["node", "apps/server/index.mjs"]
