import type { IconType } from "react-icons";
import {
  HiOutlineBookOpen,
  HiOutlineCalendarDays,
  HiOutlineFaceSmile,
  HiOutlineLightBulb,
  HiOutlineMicrophone,
  HiOutlineMusicalNote,
  HiOutlineSparkles,
  HiOutlineSquares2X2,
  HiOutlineTicket,
  HiOutlineTrophy,
} from "react-icons/hi2";

const categoryIconMap: Record<string, IconType> = {
  musik: HiOutlineMusicalNote,
  music: HiOutlineMusicalNote,
  konser: HiOutlineMicrophone,
  festival: HiOutlineSparkles,
  olahraga: HiOutlineTrophy,
  sports: HiOutlineTrophy,
  workshop: HiOutlineLightBulb,
  seminar: HiOutlineBookOpen,
  teater: HiOutlineFaceSmile,
  komedi: HiOutlineFaceSmile,
};

export function getCategoryIcon(slug: string): IconType {
  const key = slug.toLowerCase();
  for (const [match, Icon] of Object.entries(categoryIconMap)) {
    if (key.includes(match)) return Icon;
  }
  return HiOutlineTicket;
}

export const AllCategoriesIcon = HiOutlineSquares2X2;
export const EmptyEventsIcon = HiOutlineCalendarDays;
