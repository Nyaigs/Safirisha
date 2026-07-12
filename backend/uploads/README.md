# Uploads Directory

This directory stores runtime-generated uploads for the Safirisha backend.

## What goes here

- Vehicle images (`/vehicles/`)
- Ownership proof documents (`/ownership/`)

## Important

- **These files are intentionally ignored by Git** (see `.gitignore`)
- This directory is created automatically by the upload middleware
- Files are generated with timestamp-based names to avoid collisions
- Maximum file size: 5MB
- Only image files are accepted

## Production Consideration

For production, we will use a cloud object storage service such as:

- Amazon S3
- Cloudinary
- Supabase Storage
- Azure Blob Storage
- Google Cloud Storage

The current local storage is suitable for development only.
