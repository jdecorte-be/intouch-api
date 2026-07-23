-- AlterTable
ALTER TABLE "users" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "homeLatitude" DOUBLE PRECISION,
ADD COLUMN     "homeLongitude" DOUBLE PRECISION,
ADD COLUMN     "languagesSpoken" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
