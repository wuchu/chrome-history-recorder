## ADDED Requirements

### Requirement: Streaming upload endpoint

The VFS HTTP server SHALL expose a `POST /upload` endpoint that streams a raw request body into the workspace without buffering the complete file in service memory.

#### Scenario: Upload a video
- **WHEN** a client sends `POST /upload` with a raw body, a supported `Content-Type`, a valid `X-Source-Url` header, and an optional `X-Captured-At` header
- **THEN** the server streams the body to a temporary file while computing its SHA-256 hash
- **AND** on completion the server stores the blob as `{hash}.{ext}` using the MIME type mapping
- **AND** the server inserts file metadata with the matching system tag (`system:image` or `system:video`)
- **AND** the server responds `200` with JSON containing `hash`, `duplicate: false`, `size`, and `mimeType`

#### Scenario: Duplicate content
- **WHEN** the uploaded content hash already exists in the metadata database
- **THEN** the server discards the temporary file
- **AND** the server responds `200` with JSON containing `hash`, `duplicate: true`, and `size`
- **AND** the server does not create another metadata row

#### Scenario: Size limit exceeded
- **WHEN** the received byte count exceeds the configured maximum upload size
- **THEN** the server stops reading the request, deletes the temporary file, and responds `413 Payload Too Large`
- **AND** no metadata row is created

#### Scenario: Unsupported MIME type
- **WHEN** the `Content-Type` header is missing or is not `image/*` or `video/*`
- **THEN** the server responds `400 Bad Request` or `415 Unsupported Media Type` respectively
- **AND** no temporary file is retained

#### Scenario: Interrupted upload
- **WHEN** the client aborts the request before it completes
- **THEN** the server deletes the temporary file
- **AND** no metadata row is created

#### Scenario: Upload CORS preflight
- **WHEN** a client sends `OPTIONS /upload`
- **THEN** the server responds `204` with `Access-Control-Allow-Methods` including `POST` and `Access-Control-Allow-Headers` including `Content-Type`, `X-Source-Url`, and `X-Captured-At`

### Requirement: Uploaded file metadata

The upload endpoint SHALL record the same metadata fields as the existing `saveFile` operation.

#### Scenario: Metadata recorded
- **WHEN** an upload is stored
- **THEN** the stored metadata includes the content hash, blob extension, MIME type, size, source URL, capture time, and system tag
- **AND** the file is immediately visible to the existing file listing and statistics endpoints

#### Scenario: Thumbnail available after upload
- **WHEN** a stored upload is a video
- **THEN** the existing thumbnail endpoint serves a first-frame thumbnail generated from the stored blob
