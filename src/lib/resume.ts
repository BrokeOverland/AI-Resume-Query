import fs from "node:fs";
import path from "node:path";
import type { ResumeBullet, ResumeData } from "@/lib/types";

const RESUME_LOAD_ERROR =
  "No resume loaded, please add a resume json file to /data directory.";

function resolveResumePath(): string {
  const resumeId = process.env.RESUME_ID;
  if (!resumeId) {
    throw new Error(RESUME_LOAD_ERROR);
  }
  const safeResumeId = path.basename(resumeId);
  if (safeResumeId !== resumeId) {
    throw new Error(RESUME_LOAD_ERROR);
  }
  return path.join(process.cwd(), "data", `${safeResumeId}.json`);
}

export function getResumeData(): ResumeData {
  const resumePath = resolveResumePath();
  if (!fs.existsSync(resumePath)) {
    throw new Error(RESUME_LOAD_ERROR);
  }
  try {
    const rawData = fs.readFileSync(resumePath, "utf8");
    const resume = JSON.parse(rawData) as ResumeData;
    if (!Array.isArray(resume.suggestedQuestions)) {
      resume.suggestedQuestions = [];
    }
    return resume;
  } catch (error) {
    console.error("Resume load failed", error);
    throw new Error(RESUME_LOAD_ERROR);
  }
}

export function findBulletById(
  resume: ResumeData,
  bulletId: string,
): ResumeBullet | null {
  for (const experience of resume.experience) {
    const match = experience.bullets.find((bullet) => bullet.id === bulletId);
    if (match) {
      return match;
    }
  }
  return null;
}
