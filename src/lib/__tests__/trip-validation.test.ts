import { describe, it, expect } from "vitest";

function validateTripInput(data: {
  title?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  budget?: string;
  maxTravelers?: string;
  paceLevel?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.title?.trim()) errors.title = "Trip title is required";
  if (!data.destination?.trim()) errors.destination = "Destination is required";
  if (!data.startDate) errors.startDate = "Start date is required";
  if (!data.endDate) errors.endDate = "End date is required";
  if (!data.budget) errors.budget = "Budget is required";

  if (Object.keys(errors).length > 0) return errors;

  const start = new Date(data.startDate!);
  const end = new Date(data.endDate!);
  const budget = parseInt(data.budget!, 10);
  const maxTravelers = parseInt(data.maxTravelers || "20", 10);

  if (isNaN(start.getTime())) errors.startDate = "Invalid start date";
  if (isNaN(end.getTime())) errors.endDate = "Invalid end date";
  if (isNaN(budget) || budget <= 0)
    errors.budget = "Budget must be a positive number";
  if (end <= start) errors.endDate = "End date must be after start date";

  const dayCount =
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (dayCount > 30) errors.endDate = "Trip cannot exceed 30 days";

  if (maxTravelers < 1 || maxTravelers > 20)
    errors.maxTravelers = "Travelers must be between 1 and 20";

  if (
    data.paceLevel &&
    !["easy", "balanced", "full"].includes(data.paceLevel)
  )
    errors.paceLevel = "Invalid pace level";

  return errors;
}

describe("trip creation validation", () => {
  it("accepts valid input", () => {
    const errors = validateTripInput({
      title: "Goa Trip",
      destination: "Goa, India",
      startDate: "2025-03-01",
      endDate: "2025-03-05",
      budget: "50000",
      maxTravelers: "4",
      paceLevel: "balanced",
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("rejects missing title", () => {
    const errors = validateTripInput({
      title: "",
      destination: "Goa",
      startDate: "2025-03-01",
      endDate: "2025-03-05",
      budget: "50000",
    });
    expect(errors.title).toBeDefined();
  });

  it("rejects missing destination", () => {
    const errors = validateTripInput({
      title: "Trip",
      destination: "",
      startDate: "2025-03-01",
      endDate: "2025-03-05",
      budget: "50000",
    });
    expect(errors.destination).toBeDefined();
  });

  it("rejects end date before start date", () => {
    const errors = validateTripInput({
      title: "Trip",
      destination: "Goa",
      startDate: "2025-03-05",
      endDate: "2025-03-01",
      budget: "50000",
    });
    expect(errors.endDate).toBeDefined();
  });

  it("rejects trip longer than 30 days", () => {
    const errors = validateTripInput({
      title: "Trip",
      destination: "Goa",
      startDate: "2025-01-01",
      endDate: "2025-03-01",
      budget: "50000",
    });
    expect(errors.endDate).toContain("30 days");
  });

  it("rejects zero budget", () => {
    const errors = validateTripInput({
      title: "Trip",
      destination: "Goa",
      startDate: "2025-03-01",
      endDate: "2025-03-05",
      budget: "0",
    });
    expect(errors.budget).toBeDefined();
  });

  it("rejects negative budget", () => {
    const errors = validateTripInput({
      title: "Trip",
      destination: "Goa",
      startDate: "2025-03-01",
      endDate: "2025-03-05",
      budget: "-5000",
    });
    expect(errors.budget).toBeDefined();
  });

  it("rejects maxTravelers > 20", () => {
    const errors = validateTripInput({
      title: "Trip",
      destination: "Goa",
      startDate: "2025-03-01",
      endDate: "2025-03-05",
      budget: "50000",
      maxTravelers: "25",
    });
    expect(errors.maxTravelers).toBeDefined();
  });

  it("rejects maxTravelers < 1", () => {
    const errors = validateTripInput({
      title: "Trip",
      destination: "Goa",
      startDate: "2025-03-01",
      endDate: "2025-03-05",
      budget: "50000",
      maxTravelers: "0",
    });
    expect(errors.maxTravelers).toBeDefined();
  });

  it("rejects invalid pace level", () => {
    const errors = validateTripInput({
      title: "Trip",
      destination: "Goa",
      startDate: "2025-03-01",
      endDate: "2025-03-05",
      budget: "50000",
      paceLevel: "extreme",
    });
    expect(errors.paceLevel).toBeDefined();
  });

  it("accepts all valid pace levels", () => {
    for (const pace of ["easy", "balanced", "full"]) {
      const errors = validateTripInput({
        title: "Trip",
        destination: "Goa",
        startDate: "2025-03-01",
        endDate: "2025-03-05",
        budget: "50000",
        paceLevel: pace,
      });
      expect(errors.paceLevel).toBeUndefined();
    }
  });
});
