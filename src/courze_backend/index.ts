import { update, query, IDL } from "azle";

// Define course and user structures
type Course = {
  id: string;
  instructor: string;
  price: number;
  title: string;
  progressToRefund: number; // e.g. 80% for full refund
};

type UserProgress = {
  courseId: string;
  userId: string;
  progress: number;
  refundReceived: number; // Tracks how much refund has been given
};

export default class CourzeCanister {
  private courses: Map<string, Course> = new Map();
  private progress: Map<string, UserProgress> = new Map();

  // 1. Instructor uploads a new course
  @update(
    [
      IDL.Record({
        id: IDL.Text,
        instructor: IDL.Text,
        price: IDL.Nat,
        title: IDL.Text,
        progressToRefund: IDL.Float64,
      }),
    ],
    IDL.Bool
  )
  uploadCourse(course: Course): boolean {
    if (this.courses.has(course.id)) {
      return false;
    }
    this.courses.set(course.id, course);
    return true;
  }

  // 2. Student pays to start the course
  @update([IDL.Text, IDL.Text], IDL.Bool) // courseId, userId
  enrollInCourse(courseId: string, userId: string): boolean {
    if (!this.courses.has(courseId)) {
      return false;
    }
    this.progress.set(`${userId}-${courseId}`, {
      courseId,
      userId,
      progress: 0,
      refundReceived: 0,
    });
    return true;
  }

  // 3. Update progress as the student completes the course
  @update([IDL.Text, IDL.Text, IDL.Float64], IDL.Bool) // courseId, userId, newProgress (0-100%)
  updateProgress(
    courseId: string,
    userId: string,
    newProgress: number
  ): boolean {
    const progressKey = `${userId}-${courseId}`;
    if (!this.progress.has(progressKey)) {
      return false;
    }
    const userProgress = this.progress.get(progressKey);
    userProgress!.progress = newProgress;

    // Check for refund eligibility
    const course = this.courses.get(courseId);
    if (
      newProgress >= course!.progressToRefund &&
      userProgress!.refundReceived < 0.8 * course!.price
    ) {
      const refundAmount = Math.min(
        0.8 * course!.price - userProgress!.refundReceived,
        0.2 * course!.price
      );
      userProgress!.refundReceived += refundAmount;
      // Process the refund via ICP cycles here (logic not included in this stub)
    }
    this.progress.set(progressKey, userProgress!);
    return true;
  }

  // 4. Check course progress and refund status
  @query(
    [IDL.Text, IDL.Text],
    IDL.Opt(
      IDL.Record({ progress: IDL.Float64, refundReceived: IDL.Nat })
    ) as any
  )
  getCourseProgress(courseId: string, userId: string): UserProgress | null {
    const progressKey = `${userId}-${courseId}`;
    return this.progress.get(progressKey) || null;
  }
}
