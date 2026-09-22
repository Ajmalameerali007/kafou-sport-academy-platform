# Private local attendance matching

This experimental service uses OpenCV YuNet 2023mar detection and SFace 2021dec identity embeddings. It runs only on loopback with a private shared key. The application separately authorizes each session, restricts matching to its eligible consented references and verifies signed results against current permissions, reference versions and draft revision. It cannot be enabled for non-synthetic children through these endpoints.

## Reproduce the local experiment

Create `.attendance-local/venv` with Python and install `scripts/attendance/requirements.txt`. Place the official model binaries below in `.attendance-local/models/` after checking their hashes. Run `python scripts/attendance/configure-local.py` only against the existing local database after the attendance migrations. Start `.attendance-local/venv/bin/python scripts/attendance/local_service.py` separately from the application. This does not start any external delivery service.

| Model | Official binary | SHA-256 |
| --- | --- | --- |
| YuNet | https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx | 8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4 |
| SFace | https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx | 0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79 |

The OpenCV Zoo model folders label YuNet MIT and SFace Apache-2.0. This does **not** settle all commercial pretrained-weight/training-data rights; the upstream question https://github.com/opencv/opencv_zoo/issues/313 is an unresolved release consideration. Official API documentation: https://docs.opencv.org/4.13.0/d0/dd4/tutorial_dnn_face.html. No purchased service or per-image API fee is involved; local CPU, storage and generation compute still have costs. Real-child use requires separate approval, consent and representative validation.

## Privacy and retention

The private queue uses SQLite with secure deletion, mode 0600, a single worker, at most 16 queued/running requests and up to three explicit retry attempts. Interrupted work resumes on service restart. The trusted local worker rechecks the submitting actor’s current assignment, permissions, session state and exact consented reference set immediately before inference; result acceptance rechecks them again. Completed jobs discard input bytes immediately; all jobs and results expire after five minutes while the service runs or on restart. No continuous camera processing. Reference photographs and versioned templates are private and expire after 30 days or withdrawal; the database denies expired/revoked references immediately and the local worker physically removes obsolete files. If the service is stopped, physical cleanup resumes when it restarts. No backups of biometric files are created by this service. Group photos are never included in parent views, public storage or logs.

The separate academy transactional outbox handles in-app attendance events; it does not send WhatsApp or transfer money. The inference queue never commits attendance itself: the authenticated application accepts a completed result only after server revalidation. Leaving a page may leave a short-lived inference job; attendance is not finalized in the background.

Synthetic fixtures are private under `test-assets/attendance-recognition/`, excluded from Git and production assets. `MANIFEST.private.json` documents generated identities, duplicate scenes and permissions. Do not substitute real KAFOU photos.

Run `test_jobs.py` for queue plumbing, `test_engine.py` for actual installed-model rejection/matching checks, and `evaluate.py` for per-scene scores/timing. Synthetic adults do not establish accuracy for children, swimmers or twins. Threshold 0.60 and next-candidate separation 0.12 are conservative experimental settings, not a production accuracy guarantee.
