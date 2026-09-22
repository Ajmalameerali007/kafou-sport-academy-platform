import { media, type MediaId } from "./media";
import type { SportId } from "./types";
export const sports: {
  id: SportId;
  number: string;
  name: string;
  tag: string;
  headline: string;
  description: string;
  image: string;
  alt: string;
  focus: string;
}[] = [
  {
    id: "swimming",
    number: "01",
    name: "Swimming",
    tag: "FIND THEIR FLOW",
    headline: "CONFIDENCE.\nIN EVERY STROKE.",
    description:
      "From finding comfort in the water to refining every stroke. A sport that builds confidence, coordination and a sense of possibility.",
    image: media.swimming.src,
    alt: "Young swimmer practising a butterfly stroke in a pool",
    focus: "Water confidence · Technique · Endurance",
  },
  {
    id: "football",
    number: "02",
    name: "Football",
    tag: "FIND THEIR TEAM",
    headline: "BIG DREAMS.\nONE TEAM.",
    description:
      "Learn the game. Love the teamwork. Develop ball skills, decision-making and the confidence to play their own way.",
    image: media.football.src,
    alt: "Young football players practising together on a grass pitch",
    focus: "Ball skills · Teamwork · Game awareness",
  },
  {
    id: "karate",
    number: "03",
    name: "Karate",
    tag: "FIND THEIR FOCUS",
    headline: "INNER STRENGTH.\nOUTWARD CONFIDENCE.",
    description:
      "Purpose in every movement. Explore a discipline that brings balance, control and respect into sport and everyday life.",
    image: media.karate.src,
    alt: "Young karate students practising together in white uniforms",
    focus: "Discipline · Balance · Self-confidence",
  },
  {
    id: "badminton",
    number: "04",
    name: "Badminton",
    tag: "FIND THEIR RHYTHM",
    headline: "QUICK FEET.\nSHARP MINDS.",
    description:
      "Turn energy into agility. Build reactions, precision and movement through the rhythm of racket and shuttle.",
    image: media.badminton.src,
    alt: "Young badminton player holding a racket during indoor training",
    focus: "Agility · Coordination · Precision",
  },
];
export const programs = [
  {
    name: "Sports Camps",
    label: "HOLIDAYS, FULL OF POSSIBILITY",
    text: "More movement. New friendships. An active way to spend the school holidays.",
    mediaId: "agility" as MediaId,
  },
  {
    name: "Fun Days",
    label: "ROOM TO PLAY",
    text: "Shared games and joyful movement that make being active feel natural.",
    mediaId: "celebration" as MediaId,
  },
  {
    name: "Sports Days",
    label: "A LITTLE TEAM SPIRIT",
    text: "Bring a school community together through participation, teamwork and sport.",
    mediaId: "agility" as MediaId,
  },
  {
    name: "After-School Activities",
    label: "MAKE THE AFTERNOON COUNT",
    text: "A positive space to move, learn and recharge beyond the classroom.",
    mediaId: "badminton" as MediaId,
  },
  {
    name: "Kindergarten Sports Programs",
    label: "SMALL STEPS, STRONG FOUNDATIONS",
    text: "Playful introductions to balance, coordination and the joy of movement.",
    mediaId: "coaching" as MediaId,
  },
];
export const journey = [
  ["Choose Sport", "Find the activity that sparks their curiosity."],
  ["Select Location", "Explore confirmed training locations."],
  ["Register Child", "Introduce us to your young athlete."],
  ["Book Free Trial", "Discover the right starting point."],
  ["Join the Right Class", "Find their rhythm at the right level."],
  ["Develop & Progress", "Build skills, confidence and a love of sport."],
];
export const concepts = [
  {
    sport: "Football",
    title: "Player of the Week",
    copy: "Recognising teamwork, effort and the courage to keep going.",
    image: media.celebration.src,
    mediaId: "celebration" as MediaId,
  },
  {
    sport: "Swimming",
    title: "Level Progress",
    copy: "Making every new skill a moment worth celebrating.",
    image: media.swimming.src,
    mediaId: "swimming" as MediaId,
  },
  {
    sport: "Karate",
    title: "Discipline Milestone",
    copy: "Celebrating the focus behind every step forward.",
    image: media.karate.src,
    mediaId: "karate" as MediaId,
  },
  {
    sport: "Badminton",
    title: "Skill Achievement",
    copy: "Turning practice and persistence into personal progress.",
    image: media.badminton.src,
    mediaId: "badminton" as MediaId,
  },
];
