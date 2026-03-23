# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Platziflix

Netflix-style online course platform. One Backend REST API consumed by three clients: Next.js web app, Android (Kotlin), and iOS (Swift). All clients point to `http://localhost:8000`.

---

## Development Commands

### Backend — everything runs inside Docker

```bash
cd Backend
make start            # Start api + db containers
make stop             # Stop containers
make logs             # Tail logs
make migrate          # Run pending Alembic migrations
make create-migration # Prompts for name, auto-generates migration file
make seed             # Seed DB with test data
make seed-fresh       # Clear + re-seed

# Run tests (inside container)
docker-compose exec api bash -c "cd /app && uv run pytest app/test_main.py -v"
docker-compose exec api bash -c "cd /app && uv run pytest app/tests/ -v"
# Single file
docker-compose exec api bash -c "cd /app && uv run pytest app/tests/test_rating_endpoints.py -v"
```

> **Never run Python/Alembic/UV commands on the host.** Always verify containers are up before executing any `make` or `docker-compose exec` command.

### Frontend

```bash
cd Frontend
yarn dev              # Dev server :3000 (Turbopack)
yarn build            # Production build
yarn test             # All tests (Vitest)
yarn lint             # ESLint
yarn test src/components/StarRating/__tests__/StarRating.test.tsx  # Single file
```

---

## URLs

| Service | URL |
|---|---|
| Backend API | http://localhost:8000 |
| Frontend | http://localhost:3000 |
| Swagger Docs | http://localhost:8000/docs |

---

## Backend Architecture

**Stack:** FastAPI + PostgreSQL 15 + SQLAlchemy 2.0 + Alembic + UV + Docker Compose

**Entry point:** `Backend/app/main.py` — all routes defined here.

**Layered flow:**
```
HTTP Route (main.py)
  → CourseService (app/services/course_service.py)   ← all business logic
  → SQLAlchemy Models (app/models/)
  → PostgreSQL
```

**Key patterns:**
- `CourseService` is injected via FastAPI `Depends()` — single service class, no separate repositories
- **Soft deletes everywhere**: all models have `deleted_at`; queries always filter `Model.deleted_at.is_(None)`
- **Ratings upsert**: `POST /courses/{id}/ratings` creates OR updates — one active rating per `(course_id, user_id)`

**Models:**
- `Course` ↔ `Teacher` via `course_teachers` junction (M2M)
- `Course` → `Lesson` (1:M) — **important**: the API exposes Lessons as "classes"
- `CourseRating` — soft-deleted on removal, aggregated stats computed in SQL

**Pydantic schemas** only exist for ratings (`app/schemas/rating.py`). Courses return plain dicts.

**All API endpoints:**

```
GET  /                                          Welcome
GET  /health                                    DB connectivity check
GET  /courses                                   List with average_rating, total_ratings
GET  /courses/{slug}                            Detail: teacher_id[], classes[], rating fields
GET  /classes/{class_id}                        Lesson detail with video URL

POST   /courses/{course_id}/ratings             Create or update (upsert)
GET    /courses/{course_id}/ratings             List active ratings
GET    /courses/{course_id}/ratings/stats       Aggregated: average, total, distribution 1-5
GET    /courses/{course_id}/ratings/user/{uid}  User's rating (204 if none)
PUT    /courses/{course_id}/ratings/{user_id}   Explicit update (404 if not found)
DELETE /courses/{course_id}/ratings/{user_id}   Soft delete
```

**DB migrations:** `Backend/app/alembic/versions/` — always create a migration for any schema change.

---

## Frontend Architecture

**Stack:** Next.js 15 (App Router) + React 19 + TypeScript strict + SCSS Modules + Vitest

**Data flow:** Server Components fetch directly from backend. No global state management.

```
app/page.tsx                fetch → /courses      → CourseGrid → CourseCard → StarRating
app/course/[slug]/page.tsx  fetch → /courses/{slug} → CourseDetail
app/classes/[class_id]/     fetch → /classes/{id}   → VideoPlayer
```

**Important:** `app/page.tsx` and `app/course/[slug]/page.tsx` have the backend URL hardcoded as `http://localhost:8000`. Only `src/services/ratingsApi.ts` uses `process.env.NEXT_PUBLIC_API_URL`.

**Key files:**
- `src/types/index.ts` — core interfaces: `Course`, `Class`, `CourseDetail`
- `src/types/rating.ts` — `CourseRating`, `RatingRequest`, `RatingStats`, `ApiError`, type guards
- `src/services/ratingsApi.ts` — all rating CRUD, 10s timeout, custom `ApiError`

**Styling:** CSS Modules per component + `src/styles/vars.scss` auto-imported globally via `next.config.ts` `prependData`.

**Tests:** Co-located in `__test__/` or `__tests__/` subdirs next to each component.

---

## Android Architecture

**Stack:** Kotlin + Jetpack Compose + Retrofit + Coroutines + Coil + Material 3

**Pattern: MVVM + MVI**

```
Compose UI
  → emits CourseListUiEvent (sealed class)
  → CourseListViewModel (StateFlow<CourseListUiState>)
  → RemoteCourseRepository (implements CourseRepository interface)
  → ApiService (Retrofit)
  → Backend
  ← CourseDTO → CourseMapper → Domain Course model
```

**DI:** Manual via `AppModule` singleton object. Toggle `USE_MOCK_DATA = true` to use `MockCourseRepository` during development.

**Key files:**
- `di/AppModule.kt` — wires dependencies, toggle mock/real
- `data/network/ApiService.kt` — Retrofit interface
- `presentation/courses/viewmodel/CourseListViewModel.kt` — state + events
- `presentation/courses/state/CourseListUiState.kt` — UI state data class

---

## iOS Architecture

**Stack:** Swift + SwiftUI + URLSession (async/await) + Combine

**Pattern: Repository + MVVM**

```
SwiftUI View (@ObservedObject)
  → CourseListViewModel (@MainActor, @Published)
  → RemoteCourseRepository (implements CourseRepositoryProtocol)
  → NetworkManager.shared (URLSession)
  → CourseAPIEndpoints (enum: getAllCourses, getCourseBySlug)
  → Backend
  ← CourseDTO → CourseMapper → Domain Course model
```

**Key patterns:**
- `@MainActor` on ViewModel ensures all `@Published` updates are on main thread
- Search filtering via computed `filteredCourses` + Combine debounce (300ms) on `$searchText`
- `NetworkError` enum maps HTTP/URLSession errors to Spanish user messages
- `Result<T, Error>` wrappers on repository methods

**Key files:**
- `Services/NetworkManager.swift` — URLSession wrapper, error mapping
- `Services/APIEndpoint.swift` — protocol all endpoints conform to
- `Data/Repositories/CourseAPIEndpoints.swift` — enum with base URL and paths
- `Presentation/ViewModels/CourseListViewModel.swift` — reactive state

---

## Cross-platform Data Contract

All three clients share the same JSON contract from the backend:

**`GET /courses` response:**
```json
{ "id": 1, "name": "...", "description": "...", "thumbnail": "url", "slug": "...", "average_rating": 4.2, "total_ratings": 87 }
```

**`GET /courses/{slug}` response:**
```json
{ "id": 1, ..., "teacher_id": [1, 2], "classes": [{"id": 1, "name": "...", "description": "...", "slug": "..."}], "average_rating": 4.2, "total_ratings": 87, "rating_distribution": {"1": 0, "2": 3, "3": 10, "4": 30, "5": 44} }
```

Note: `classes` in the API response are `Lesson` rows in the DB.

---

## Naming Conventions

| Platform | Convention |
|---|---|
| Python (Backend) | `snake_case` |
| TypeScript (Frontend) | `camelCase` / `PascalCase` for components |
| Kotlin (Android) | `camelCase` / `PascalCase` for classes |
| Swift (iOS) | `camelCase` / `PascalCase` for types |

---

## Testing

| Platform | Framework | Run command |
|---|---|---|
| Backend | pytest | `docker-compose exec api bash -c "cd /app && uv run pytest"` |
| Frontend | Vitest + RTL | `yarn test` |
| Android | JUnit + Coroutines | Android Studio or Gradle |
| iOS | XCTest | Xcode Test Navigator |
