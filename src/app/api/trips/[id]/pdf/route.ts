import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await props.params;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { groupMembers: true }
    });

    if (!trip) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const isMember = trip.groupMembers.some((m) => m.userId === session?.user?.id);
    if (!isMember) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Determine the base URL securely to prevent SSRF via Host header injection
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;

    // Ensure id only contains safe characters to prevent path traversal / SSRF via id injection
    if (!/^[a-z0-9-]+$/i.test(id)) {
      return new NextResponse("Invalid Trip ID", { status: 400 });
    }

    const printUrl = `${baseUrl}/trips/${id}/print`;

    // Launch headless browser
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();

      // Pass the session cookie to the headless browser so it can access the protected print page
      const cookieHeader = req.headers.get("cookie");
      if (cookieHeader) {
        const cookies = cookieHeader.split(";").map(c => {
          const [name, ...rest] = c.trim().split("=");
          return {
            name,
            value: rest.join("="),
            domain: new URL(baseUrl).hostname,
            path: "/",
            secure: true,
            sameSite: "Lax" as const
          };
        });
        await context.addCookies(cookies);
      }

      const page = await context.newPage();
      
      // Navigate to the print page with a strict timeout
      await page.goto(printUrl, { waitUntil: "networkidle", timeout: 15000 });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "20mm",
          right: "20mm",
          bottom: "20mm",
          left: "20mm"
        }
      });

      // Return the PDF
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new NextResponse(pdfBuffer as any, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="roamwise-trip-${id}.pdf"`,
        },
      });
    } finally {
      if (browser) {
        await browser.close().catch(console.error);
      }
    }
  } catch (error) {
    // Sanitize error output
    console.error("PDF generation failed.");
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
