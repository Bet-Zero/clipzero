import { describe, expect, it } from "vitest";
import { selectVideoFromEventAsset } from "./nba";

describe("selectVideoFromEventAsset", () => {
  it("returns null when there are no video URLs", () => {
    expect(selectVideoFromEventAsset(null)).toBeNull();
    expect(selectVideoFromEventAsset({})).toBeNull();
    expect(
      selectVideoFromEventAsset({ resultSets: { Meta: { videoUrls: [] } } }),
    ).toBeNull();
  });

  it("prefers _1280x720 when multiple renditions exist", () => {
    const asset = {
      resultSets: {
        Meta: {
          videoUrls: [
            {
              murl: "https://videos.nba.com/.../foo_960x540.mp4",
              mth: "https://thumb/960.jpg",
            },
            {
              murl: "https://videos.nba.com/.../foo_1280x720.mp4",
              mth: "https://thumb/720.jpg",
            },
          ],
        },
      },
    };
    expect(selectVideoFromEventAsset(asset)).toEqual({
      murl: "https://videos.nba.com/.../foo_1280x720.mp4",
      mth: "https://thumb/720.jpg",
    });
  });

  it("falls back to the first valid murl when 1280x720 is absent", () => {
    const asset = {
      resultSets: {
        Meta: {
          videoUrls: [
            { murl: "https://videos.nba.com/.../bar_1920x1080.mp4", mth: "a" },
          ],
        },
      },
    };
    expect(selectVideoFromEventAsset(asset)).toEqual({
      murl: "https://videos.nba.com/.../bar_1920x1080.mp4",
      mth: "a",
    });
  });
});
