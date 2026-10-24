FROM node:24-alpine
WORKDIR /opt/iris-terrain-studio
# Build the checked standalone distribution before building the runtime image.
COPY dist/ ./
RUN node --input-type=module -e "import{inspectRuntimeInstallation}from'./apps/server/runtime-status.mjs';const runtime=await inspectRuntimeInstallation(process.cwd(),{distribution:true});if(!runtime.available||!runtime.registry.available)throw new Error('Prepare dist with npm run build -- --require-engine before building the image.');"
RUN mkdir -p /data/packs && chown -R node:node /data /opt/iris-terrain-studio
USER node
ENV HOST=0.0.0.0 PORT=4783 IRIS_PACKS_DIR=/data/packs
VOLUME ["/data/packs"]
EXPOSE 4783
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:4783/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/server/index.mjs"]
