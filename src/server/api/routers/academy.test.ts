import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth, currentUser: vi.fn() }));
vi.mock("@/server/db", () => ({ db: {} }));

import { academyRouter } from "./academy";

const lessonA = {
  id: "lesson-a",
  title: "Aula A",
  slug: "aula-a",
  description: "Primeira aula",
  videoUrl: "https://example.com/a",
  thumbnailUrl: null,
  duration: 120,
  order: 1,
  isFree: true,
};
const lessonB = {
  ...lessonA,
  id: "lesson-b",
  title: "Aula B",
  slug: "aula-b",
  duration: null,
  order: 2,
  isFree: false,
};
const lessonC = {
  ...lessonA,
  id: "lesson-c",
  title: "Aula C",
  slug: "aula-c",
  duration: 60,
  order: 1,
};
const moduleOne = {
  id: "module-1",
  title: "Módulo 1",
  slug: "modulo-1",
  description: null,
  coverImageUrl: "https://example.com/capa.png",
  order: 1,
  lessons: [lessonA, lessonB],
};
const moduleTwo = {
  ...moduleOne,
  id: "module-2",
  title: "Módulo 2",
  slug: "modulo-2",
  order: 2,
  lessons: [lessonC],
};

function setup() {
  const db = {
    academyModule: {
      findMany: vi.fn().mockResolvedValue([moduleOne, moduleTwo]),
    },
    academyLesson: {
      findUnique: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    academyLessonProgress: {
      findMany: vi.fn().mockResolvedValue([
        { lessonId: "lesson-a", completed: true, progressPercent: 100 },
        { lessonId: "lesson-c", completed: false, progressPercent: 40 },
        // Aula despublicada continua contando no total concluído (como antes).
        { lessonId: "lesson-old", completed: true, progressPercent: 100 },
      ]),
      findUnique: vi.fn().mockResolvedValue(null),
      groupBy: vi.fn().mockResolvedValue([
        { lessonId: "lesson-a", _count: { _all: 7 } },
        { lessonId: "lesson-c", _count: { _all: 2 } },
      ]),
      count: vi.fn().mockResolvedValue(0),
    },
    academyLessonLike: {
      findMany: vi.fn().mockResolvedValue([{ lessonId: "lesson-b" }]),
      findUnique: vi.fn().mockResolvedValue(null),
      groupBy: vi
        .fn()
        .mockResolvedValue([{ lessonId: "lesson-b", _count: { _all: 3 } }]),
      count: vi.fn().mockResolvedValue(0),
    },
  };
  return {
    db,
    api: academyRouter.createCaller({ db, headers: new Headers() } as never),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ userId: "user-1" });
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("academia — área de membros", () => {
  it("mescla contagens filtradas pelas aulas exibidas sem alterar a resposta", async () => {
    const { api, db } = setup();
    const result = await api.getMemberContent();

    expect(result).toEqual({
      modules: [
        {
          id: "module-1",
          title: "Módulo 1",
          slug: "modulo-1",
          description: null,
          coverImageUrl: "https://example.com/capa.png",
          order: 1,
          lessons: [
            {
              ...lessonA,
              completedCount: 7,
              likesCount: 0,
              isCompleted: true,
              progressPercent: 100,
              isLiked: false,
            },
            {
              ...lessonB,
              completedCount: 0,
              likesCount: 3,
              isCompleted: false,
              progressPercent: 0,
              isLiked: true,
            },
          ],
          lessonsCount: 2,
          completedLessonsCount: 1,
          progress: 50,
          totalDuration: 120,
        },
        {
          id: "module-2",
          title: "Módulo 2",
          slug: "modulo-2",
          description: null,
          coverImageUrl: "https://example.com/capa.png",
          order: 2,
          lessons: [
            {
              ...lessonC,
              completedCount: 2,
              likesCount: 0,
              isCompleted: false,
              progressPercent: 40,
              isLiked: false,
            },
          ],
          lessonsCount: 1,
          completedLessonsCount: 0,
          progress: 0,
          totalDuration: 60,
        },
      ],
      stats: {
        totalModules: 2,
        totalLessons: 3,
        completedLessons: 2,
        totalDuration: 180,
        overallProgress: 67,
      },
    });

    const lessonIds = ["lesson-a", "lesson-b", "lesson-c"];
    expect(db.academyLessonProgress.groupBy).toHaveBeenCalledWith({
      by: ["lessonId"],
      where: { lessonId: { in: lessonIds }, completed: true },
      _count: { _all: true },
    });
    expect(db.academyLessonLike.groupBy).toHaveBeenCalledWith({
      by: ["lessonId"],
      where: { lessonId: { in: lessonIds } },
      _count: { _all: true },
    });
    // Nada de `_count` de relação (LEFT JOIN sobre as tabelas inteiras).
    expect(
      JSON.stringify(db.academyModule.findMany.mock.calls[0]),
    ).not.toContain("_count");
    expect(db.academyModule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isPublished: true },
        orderBy: { order: "asc" },
      }),
    );
  });

  it("não agrupa contagens quando não há aulas publicadas", async () => {
    const { api, db } = setup();
    db.academyModule.findMany.mockResolvedValue([]);
    db.academyLessonProgress.findMany.mockResolvedValue([]);
    db.academyLessonLike.findMany.mockResolvedValue([]);
    expect(await api.getMemberContent()).toEqual({
      modules: [],
      stats: {
        totalModules: 0,
        totalLessons: 0,
        completedLessons: 0,
        totalDuration: 0,
        overallProgress: 0,
      },
    });
    expect(db.academyLessonProgress.groupBy).not.toHaveBeenCalled();
    expect(db.academyLessonLike.groupBy).not.toHaveBeenCalled();
  });

  it("conta conclusões e curtidas só da aula aberta", async () => {
    const { api, db } = setup();
    db.academyLesson.findUnique.mockResolvedValue({
      ...lessonA,
      moduleId: "module-1",
      isPublished: true,
      module: { id: "module-1", title: "Módulo 1", slug: "modulo-1" },
    });
    db.academyLessonProgress.count.mockResolvedValue(7);
    db.academyLessonLike.count.mockResolvedValue(3);
    db.academyLessonLike.findUnique.mockResolvedValue({ id: "like-1" });
    db.academyLesson.findFirst
      .mockResolvedValueOnce({ slug: "aula-b", title: "Aula B" })
      .mockResolvedValueOnce(null);

    expect(await api.getLessonDetails({ slug: "aula-a" })).toEqual({
      ...lessonA,
      module: { id: "module-1", title: "Módulo 1", slug: "modulo-1" },
      completedCount: 7,
      likesCount: 3,
      isCompleted: false,
      progressPercent: 0,
      isLiked: true,
      nextLesson: { slug: "aula-b", title: "Aula B" },
      prevLesson: null,
    });
    expect(db.academyLessonProgress.count).toHaveBeenCalledWith({
      where: { lessonId: "lesson-a", completed: true },
    });
    expect(db.academyLessonLike.count).toHaveBeenCalledWith({
      where: { lessonId: "lesson-a" },
    });
    expect(
      JSON.stringify(db.academyLesson.findUnique.mock.calls[0]),
    ).not.toContain("_count");
  });

  it("mantém aulas despublicadas inacessíveis", async () => {
    const { api, db } = setup();
    db.academyLesson.findUnique.mockResolvedValue({
      ...lessonA,
      moduleId: "module-1",
      isPublished: false,
      module: { id: "module-1", title: "Módulo 1", slug: "modulo-1" },
    });
    await expect(
      api.getLessonDetails({ slug: "aula-a" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.academyLessonProgress.count).not.toHaveBeenCalled();
  });
});
