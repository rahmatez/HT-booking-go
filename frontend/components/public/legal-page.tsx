import { PageHero } from "@/components/public/page-hero";
import { Container } from "@/components/ui/container";

type Props = {
  title: string;
  children: React.ReactNode;
};

export function LegalPage({ title, children }: Props) {
  return (
    <>
      <PageHero title={title} />
      <div className="py-10 sm:py-12">
        <Container narrow>
          <article className="rounded-lg border border-(--border) bg-white p-8 shadow-(--shadow-sm) sm:p-10 prose prose-slate max-w-none">
            {children}
          </article>
        </Container>
      </div>
    </>
  );
}
