import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StoreCard from "../src/components/StoreCard";

const store = {
  id: "s1",
  name: "Pizzeria Centro",
  address: {
    street: "Rue du Lyon",
    streetNumber: "3",
    postalCode: "1201",
    city: "Genève",
    country: "Switzerland",
  },
};

describe("StoreCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the store name and address", () => {
    render(<StoreCard store={store} />);

    expect(screen.getByRole("heading", { name: "Pizzeria Centro" })).toBeTruthy();
    expect(screen.getByText("Rue du Lyon 3")).toBeTruthy();
    expect(screen.getByText("1201 Genève, Switzerland")).toBeTruthy();
  });

  it("shows a placeholder when there is no image", () => {
    render(<StoreCard store={store} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByTestId("store-card-placeholder")).toBeTruthy();
  });

  it("shows the image with the store name as alt text", () => {
    render(<StoreCard store={{ ...store, imageUrl: "https://example.com/s.jpg" }} />);

    const image = screen.getByRole("img", { name: "Pizzeria Centro" });
    expect(image.getAttribute("src")).toBe("https://example.com/s.jpg");
    expect(screen.queryByTestId("store-card-placeholder")).toBeNull();
  });

  it("calls onSelect with the store when clicking Go to store", () => {
    const onSelect = vi.fn();
    render(<StoreCard store={store} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Go to store" }));

    expect(onSelect).toHaveBeenCalledWith(store);
  });
});
