import { gbFetch } from "./business";

// Google Business Profile reviews live on the legacy v4 API host. Resource path:
//   accounts/{accountId}/locations/{locationId}/reviews
// (requires the one-time Business Profile API access approval).
const V4 = "https://mybusiness.googleapis.com/v4";

const STAR_MAP: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export interface Review {
  id: string; // reviewId
  name: string; // full resource name (for replies)
  author: string;
  photo: string | null;
  rating: number;
  comment: string;
  createTime: string | null;
  reply: { comment: string; updateTime: string | null } | null;
}

export interface ReviewsResult {
  averageRating: number;
  totalReviewCount: number;
  reviews: Review[];
}

function mapReview(r: any, parent: string): Review {
  return {
    id: String(r.reviewId || ""),
    name: r.name || `${parent}/reviews/${r.reviewId}`,
    author: r.reviewer?.displayName || "Google user",
    photo: r.reviewer?.profilePhotoUrl || null,
    rating: STAR_MAP[r.starRating] ?? 0,
    comment: r.comment || "",
    createTime: r.createTime || null,
    reply: r.reviewReply ? { comment: r.reviewReply.comment || "", updateTime: r.reviewReply.updateTime || null } : null,
  };
}

// List reviews for a location (newest first), with overall rating + count.
export async function listReviews(
  token: string,
  accountName: string,
  locationName: string,
  max = 50,
): Promise<ReviewsResult> {
  const parent = `${accountName}/${locationName}`;
  const reviews: Review[] = [];
  let averageRating = 0;
  let totalReviewCount = 0;
  let pageToken: string | undefined;

  do {
    const url = new URL(`${V4}/${parent}/reviews`);
    url.searchParams.set("pageSize", "50");
    url.searchParams.set("orderBy", "updateTime desc");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await gbFetch(token, url.toString());
    averageRating = Number(data.averageRating) || averageRating;
    totalReviewCount = Number(data.totalReviewCount) || totalReviewCount;
    for (const r of data.reviews || []) reviews.push(mapReview(r, parent));
    pageToken = data.nextPageToken;
  } while (pageToken && reviews.length < max);

  return { averageRating, totalReviewCount, reviews: reviews.slice(0, max) };
}

// Create/update the business reply to a review (PUT .../reply).
export async function replyToReview(token: string, reviewName: string, comment: string): Promise<void> {
  await gbFetch(token, `${V4}/${reviewName}/reply`, {
    method: "PUT",
    body: JSON.stringify({ comment }),
  });
}
