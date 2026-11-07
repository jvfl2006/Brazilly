-- Shared profile scene library and personal profile backgrounds support static images.
-- Safe to re-run. Existing buckets remain public/private as originally configured.
update storage.buckets
set allowed_mime_types = array[
 'image/gif','image/webp','image/png','image/jpeg','image/avif','video/mp4','video/webm'
]
where id in ('profile-scene-library','profile-scenes');
