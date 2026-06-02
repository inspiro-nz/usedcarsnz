import Footer from "@/components/Footer";
import FAQ from "@/components/FAQ";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Navbar from "@/components/Navbar";
import PilotForm from "@/components/PilotForm";
import Problem from "@/components/Problem";
import WhyDealersJoin from "@/components/WhyDealersJoin";

export default function Page() {
  return (
    <>
      <Navbar />
      <main id="top" className="bg-white">
        <Hero />
        <Problem />
        <HowItWorks />
        <WhyDealersJoin />
        <PilotForm />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
