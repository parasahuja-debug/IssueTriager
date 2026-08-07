# Post supabase start - 
        PI URL: http://127.0.0.1:54321
            GraphQL URL: http://127.0.0.1:54321/graphql/v1
        S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
                MCP URL: http://127.0.0.1:54321/mcp
            Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
            Studio URL: http://127.0.0.1:54323
            Mailpit URL: http://127.0.0.1:54324
        Publishable key: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
            Secret key: sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
        S3 Access Key: 625729a08b95bf1b7ff351a663f3a23c
        S3 Secret Key: 850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907
            S3 Region: local

----

# create vector 

Open the Studio URL (usually http://127.0.0.1:54323).
    Go to SQL Editor.
    Create a new query.
    Paste:
        CREATE EXTENSION IF NOT EXISTS vector;
    Run 

or using CLI- 
    psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

To check - 
    SELECT extname
    FROM pg_extension
    WHERE extname = 'vector';

-------

