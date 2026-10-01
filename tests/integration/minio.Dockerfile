# TEST ONLY. Official signed RELEASE.2025-09-07T16-13-09Z resolves to this commit.
# Source checksum and official Docker base indexes are pinned; go.sum verifies modules.
FROM golang:1.24.8-alpine3.22@sha256:3d78beb141d98f42337f1252ecf2a5f20374109929a4c3f6817f9e4179cc0ae5 AS builder
ADD --checksum=sha256:8819e3e7817e46b7b3798f8f200ead208562e571563c2e040352378031abe9f2 https://codeload.github.com/minio/minio/tar.gz/07c3a429bfed433e49018cb0f78a52145d4bedeb /tmp/minio.tar.gz
RUN mkdir /src && tar -xzf /tmp/minio.tar.gz -C /src --strip-components=1
WORKDIR /src
ENV CGO_ENABLED=0 GOTOOLCHAIN=local
RUN go build -mod=readonly -trimpath -buildvcs=false -o /out/minio .
FROM alpine:3.22.2@sha256:4b7ce07002c69e8f3d704a9c5d6fd3053be500b7f1c69fc0d80990c2ad8dd412
COPY --from=builder /out/minio /usr/local/bin/minio
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /src/LICENSE /usr/share/licenses/minio/LICENSE
LABEL org.opencontainers.image.source="https://github.com/minio/minio" org.opencontainers.image.revision="07c3a429bfed433e49018cb0f78a52145d4bedeb"
EXPOSE 9000
ENTRYPOINT ["/usr/local/bin/minio"]
