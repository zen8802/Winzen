import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAgentWithItems } from "@/app/actions/agent";
import { AgentShop } from "./AgentShop";
import { AgentCollection } from "./AgentCollection";
import { MannequinViewer } from "./MannequinViewer";

export default async function AgentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const data = await getAgentWithItems();
  if (!data) redirect("/login");

  const { agent, items, ownedIds, equippedHeadwareColor, equippedShirtColor, equippedPantsColor, equippedShoesColor, equippedAccessoryColor } = data;
  const gender = (agent?.gender === "female" ? "female" : "male") as "male" | "female";
  const needsGender = !agent;

  const ownedItems = items.filter((i) => ownedIds.has(i.id));
  const ownedByCategory = {
    headware: ownedItems.filter((i) => i.category === "headware"),
    shirt: ownedItems.filter((i) => i.category === "shirt"),
    pants: ownedItems.filter((i) => i.category === "pants"),
    shoes: ownedItems.filter((i) => i.category === "shoes"),
    accessories: ownedItems.filter((i) => i.category === "accessories"),
  };

  const categories = [
    { id: "headware", label: "Headware" },
    { id: "shirt", label: "Shirt" },
    { id: "pants", label: "Pants" },
    { id: "shoes", label: "Shoes" },
    { id: "accessories", label: "Accessories" },
  ] as const;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">
          My Agent
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Customize your avatar. Earn coins from prediction markets to buy items.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col">
          <MannequinViewer
            gender={gender as "male" | "female"}
            headwareColor={equippedHeadwareColor}
            shirtColor={equippedShirtColor}
            pantsColor={equippedPantsColor}
            shoesColor={equippedShoesColor}
            accessoryColor={equippedAccessoryColor}
          />
          {needsGender && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-200">
                Pick your gender to personalize your mannequin.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {ownedItems.length > 0 && (
            <AgentCollection
              ownedByCategory={ownedByCategory}
              equipped={{
                headware: agent?.equippedHeadwareId ?? null,
                shirt: agent?.equippedShirtId ?? null,
                pants: agent?.equippedPantsId ?? null,
                shoes: agent?.equippedShoesId ?? null,
                accessories: agent?.equippedAccessoryId ?? null,
              }}
            />
          )}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-[var(--text)]">Buy clothes</h2>
          <AgentShop
            categories={categories}
            items={items}
            ownedIds={ownedIds}
            equipped={{
              headware: agent?.equippedHeadwareId ?? null,
              shirt: agent?.equippedShirtId ?? null,
              pants: agent?.equippedPantsId ?? null,
              shoes: agent?.equippedShoesId ?? null,
              accessories: agent?.equippedAccessoryId ?? null,
            }}
            needsGender={needsGender}
          />
          </section>
        </div>
      </div>
    </div>
  );
}
