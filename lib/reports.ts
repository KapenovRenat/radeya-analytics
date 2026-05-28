import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";

export type ReportFrontmatter = {
  title: string;
  summary: string;
  date: string;
  author?: string;
  tags?: string[];
  /** Optional emoji/icon for the list view. */
  icon?: string;
  /** Headline-insight для карточки в списке (1-2 строки, главный takeaway). */
  hook?: string;
};

export type ReportMeta = ReportFrontmatter & {
  slug: string;
  readingTime: string;
};

export type ReportFull = ReportMeta & {
  content: string;
};

const REPORTS_DIR = path.join(process.cwd(), "content", "reports");

async function readDirSafe(): Promise<string[]> {
  try {
    return await fs.readdir(REPORTS_DIR);
  } catch {
    return [];
  }
}

/** List all reports, sorted by date descending. */
export async function listReports(): Promise<ReportMeta[]> {
  const files = await readDirSafe();
  const mdxFiles = files.filter((f) => f.endsWith(".mdx") || f.endsWith(".md"));

  const reports = await Promise.all(
    mdxFiles.map(async (file) => {
      const slug = file.replace(/\.mdx?$/, "");
      const raw = await fs.readFile(path.join(REPORTS_DIR, file), "utf-8");
      const { data, content } = matter(raw);
      return {
        slug,
        ...(data as ReportFrontmatter),
        readingTime: readingTime(content).text,
      };
    })
  );

  return reports.sort((a, b) => (a.date > b.date ? -1 : 1));
}

/** Load one report by slug (returns null if not found). */
export async function getReport(slug: string): Promise<ReportFull | null> {
  const tryFile = async (ext: string) => {
    try {
      const raw = await fs.readFile(path.join(REPORTS_DIR, `${slug}.${ext}`), "utf-8");
      const { data, content } = matter(raw);
      return {
        slug,
        ...(data as ReportFrontmatter),
        content,
        readingTime: readingTime(content).text,
      };
    } catch {
      return null;
    }
  };
  return (await tryFile("mdx")) ?? (await tryFile("md"));
}
