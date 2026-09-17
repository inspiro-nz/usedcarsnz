import Footer from "@/components/Footer";
import FAQ from "@/components/FAQ";
import Guardrails from "@/components/Guardrails";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Navbar from "@/components/Navbar";
import PilotForm from "@/components/PilotForm";
import Problem from "@/components/Problem";
import Proof from "@/components/Proof";
import WhyDealersJoin from "@/components/WhyDealersJoin";

export default function Page() {
  return (
    <>
      <Navbar />
      <main id="top" className="bg-white">
        <Hero />
        <Problem />
        <HowItWorks />
        <Proof />
        <WhyDealersJoin />
        <Guardrails />
        <PilotForm />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
