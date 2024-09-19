import { update, query, IDL, nat, Principal } from "azle";

// Define course and user progress types
type Course = {
  id: string;
  instructor: Principal;
  price: nat; // Price in ICP
  title: string;
  progressToRefund: number; // e.g., 80% for full refund
};

type UserProgress = {
  courseId: string;
  userId: Principal;
  progress: number; // Progress in percentage (0-100)
  refundReceived: number; // Tracks the refund given back
};

export default class CourzeCanister {
  private courses: Map<string, Course> = new Map();
  private progress: Map<string, UserProgress> = new Map();
  private nftCertificates: Map<string, string> = new Map(); // Store issued NFTs

  // Instructor uploads a new course
  @update(
    [
      IDL.Record({
        id: IDL.Text,
        instructor: IDL.Principal,
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

  // Student enrolls in the course and makes an initial payment
  @update([IDL.Text, IDL.Principal], IDL.Bool)
  enrollInCourse(courseId: string, userId: Principal): boolean {
    const course = this.courses.get(courseId);
    if (!course) {
      return false;
    }
    const key = `${userId.toText()}-${courseId}`;
    if (this.progress.has(key)) {
      return false; // Already enrolled
    }
    this.progress.set(key, {
      courseId,
      userId,
      progress: 0,
      refundReceived: 0,
    });
    return true;
  }

  // Update student's progress and trigger automatic token refund
  @update([IDL.Text, IDL.Principal, IDL.Float64], IDL.Bool)
  updateProgress(
    courseId: string,
    userId: Principal,
    newProgress: number
  ): boolean {
    const key = `${userId.toText()}-${courseId}`;
    const userProgress = this.progress.get(key);
    const course = this.courses.get(courseId);

    if (!userProgress || !course) {
      return false;
    }

    userProgress.progress = newProgress;

    // Calculate refund based on progress
    const refundPercentage =
      Math.min(newProgress, course.progressToRefund) / 100;
    const maxRefund = course.price * refundPercentage;
    const refundDue = maxRefund - userProgress.refundReceived;

    // Refund student (logic for actual ICP transfer should go here)
    if (refundDue > 0) {
      userProgress.refundReceived += refundDue;
      // Implement ICP token transfer logic here
    }

    this.progress.set(key, userProgress);

    // If progress is complete, mint an NFT certificate
    if (newProgress >= 100) {
      this.mintNFT(userId, courseId);
    }

    return true;
  }

  // Mint an NFT for the completed course
  private mintNFT(userId: Principal, courseId: string): void {
    const nftId = `${userId.toText()}-nft-${courseId}`;
    this.nftCertificates.set(
      nftId,
      `NFT for course ${courseId} completed by ${userId.toText()}`
    );
    // Implement actual NFT minting logic on ICP
  }

  // Query a student's course progress and refund status
  @query(
    [IDL.Text, IDL.Principal],
    IDL.Opt(IDL.Record({ progress: IDL.Float64, refundReceived: IDL.Nat }))
  )
  getCourseProgress(courseId: string, userId: Principal): UserProgress | null {
    const key = `${userId.toText()}-${courseId}`;
    return this.progress.get(key) || null;
  }

  // Query the NFT certificate for a course completion
  @query([IDL.Text], IDL.Opt(IDL.Text))
  getNFTCertificate(nftId: string): string | null {
    return this.nftCertificates.get(nftId) || null;
  }
}
