import React from 'react';
import { HoleCourse, CELL_SIZE, FAIRWAY_PAD, computeCourseWalls } from '../data/courses';

interface CourseMiniPreviewProps {
  course: HoleCourse;
}

export const CourseMiniPreview: React.FC<CourseMiniPreviewProps> = ({ course }) => {
  const walls = React.useMemo(() => computeCourseWalls(course), [course]);
  const cellSet = React.useMemo(
    () => new Set(course.cells.map(([c, r]) => `${c},${r}`)),
    [course.cells]
  );

  // Fixed bounding box in world units so all course previews have consistent, balanced scale
  const viewHalf = 6.4;

  return (
    <svg
      viewBox={`${-viewHalf} ${-viewHalf} ${viewHalf * 2} ${viewHalf * 2}`}
      className="w-full h-full block rounded-xl"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grass background */}
      <rect
        x={-viewHalf}
        y={-viewHalf}
        width={viewHalf * 2}
        height={viewHalf * 2}
        fill="#78eb46"
      />

      {/* Course checkerboard tiles (each 2x2 cell expands outward by FAIRWAY_PAD on outer boundaries) */}
      {course.cells.map(([col, row]) => {
        const cx = col * CELL_SIZE;
        const cz = row * CELL_SIZE;
        const hasW = cellSet.has(`${col - 1},${row}`);
        const hasE = cellSet.has(`${col + 1},${row}`);
        const hasN = cellSet.has(`${col},${row - 1}`);
        const hasS = cellSet.has(`${col},${row + 1}`);

        const subTiles: React.ReactNode[] = [];
        for (let sx = 0; sx < 2; sx++) {
          for (let sz = 0; sz < 2; sz++) {
            const tx1 = sx === 0 ? cx - 1.0 - (hasW ? 0 : FAIRWAY_PAD) : cx;
            const tx2 = sx === 0 ? cx : cx + 1.0 + (hasE ? 0 : FAIRWAY_PAD);
            const tz1 = sz === 0 ? cz - 1.0 - (hasN ? 0 : FAIRWAY_PAD) : cz;
            const tz2 = sz === 0 ? cz : cz + 1.0 + (hasS ? 0 : FAIRWAY_PAD);
            const isEven = (col * 2 + sx + row * 2 + sz) % 2 === 0;
            subTiles.push(
              <rect
                key={`${col},${row}-${sx},${sz}`}
                x={tx1}
                y={tz1}
                width={tx2 - tx1 + 0.02}
                height={tz2 - tz1 + 0.02}
                fill={isEven ? '#92f25e' : '#80e64e'}
              />
            );
          }
        }
        return <g key={`cell-${col},${row}`}>{subTiles}</g>;
      })}

      {/* Sand / Bridge Strips */}
      {course.sandStrips?.map((s, idx) => (
        <rect
          key={`sand-${idx}`}
          x={s.x - s.width / 2}
          y={s.z - s.depth / 2}
          width={s.width}
          height={s.depth}
          fill="#f6e5aa"
        />
      ))}

      {/* Moving Blocks */}
      {course.movingBlocks?.map((mb, idx) => (
        <rect
          key={`mb-${idx}`}
          x={mb.x - mb.width / 2}
          y={mb.z - mb.depth / 2}
          width={mb.width}
          height={mb.depth}
          rx={0.12}
          fill="#f08b62"
          stroke="#ffffff"
          strokeWidth={0.08}
        />
      ))}

      {/* Bumpers */}
      {course.bumpers?.map((b, idx) => (
        <circle
          key={`bumper-${idx}`}
          cx={b.x}
          cy={b.z}
          r={b.radius}
          fill="#ffffff"
          stroke="#f08b62"
          strokeWidth={0.14}
        />
      ))}

      {/* Start Tee Pad */}
      <circle
        cx={course.start[0]}
        cy={course.start[1]}
        r={0.34}
        fill="#ffffff"
        stroke="#f08b62"
        strokeWidth={0.15}
      />

      {/* Hole / Cup */}
      <circle
        cx={course.hole[0]}
        cy={course.hole[1]}
        r={0.44}
        fill="#1a1738"
        stroke="#ffffff"
        strokeWidth={0.14}
      />

      {/* Perimeter Walls */}
      {walls.map((w, idx) => (
        <line
          key={`wall-${idx}`}
          x1={w.x1}
          y1={w.z1}
          x2={w.x2}
          y2={w.z2}
          stroke="#f08b62"
          strokeWidth={0.32}
          strokeLinecap="square"
        />
      ))}
    </svg>
  );
};
