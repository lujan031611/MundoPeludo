import { Link } from "react-router";
import { Stethoscope, Scissors, Syringe, PawPrint, Calendar, Award } from "lucide-react";

export default function Home() {
  const services = [
    {
      icon: Stethoscope,
      title: "Consultas Veterinarias",
      description: "Atención médica profesional para tu mascota"
    },
    {
      icon: Syringe,
      title: "Vacunación",
      description: "Plan completo de vacunación y desparasitación"
    },
    {
      icon: Scissors,
      title: "Estética y Peluquería",
      description: "Baño, corte y cuidado estético profesional"
    },
    {
      icon: PawPrint,
      title: "Cirugías",
      description: "Quirófano equipado con tecnología de punta"
    }
  ];

  return (
    <div>
      <section className="bg-gradient-to-r from-blue-600 to-green-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl mb-6">Bienvenido a Mundo Peludo</h1>
            <p className="text-xl mb-8 text-blue-100">
              Atención veterinaria 24/7 con sistema de turnos inteligente
            </p>
            <Link
              to="/turnos"
              className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Reservar Turno
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl text-center mb-12 text-gray-900">Nuestros Servicios</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <service.icon className="w-12 h-12 text-blue-600 mb-4" />
                <h3 className="text-xl mb-2 text-gray-900">{service.title}</h3>
                <p className="text-gray-600">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <Award className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h3 className="text-3xl mb-2 text-gray-900">15+</h3>
              <p className="text-gray-600">Años de experiencia</p>
            </div>
            <div>
              <PawPrint className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h3 className="text-3xl mb-2 text-gray-900">5000+</h3>
              <p className="text-gray-600">Mascotas atendidas</p>
            </div>
            <div>
              <Calendar className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h3 className="text-3xl mb-2 text-gray-900">24/7</h3>
              <p className="text-gray-600">Disponibilidad online</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl text-center mb-12 text-gray-900">¿Por qué elegirnos?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl mb-3 text-gray-900">Profesionales Certificados</h3>
              <p className="text-gray-600">
                Nuestro equipo está formado por veterinarios con amplia experiencia y certificaciones internacionales.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl mb-3 text-gray-900">Tecnología de Punta</h3>
              <p className="text-gray-600">
                Contamos con equipamiento moderno para diagnóstico y tratamiento de última generación.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl mb-3 text-gray-900">Atención Personalizada</h3>
              <p className="text-gray-600">
                Cada mascota recibe un plan de cuidado individualizado según sus necesidades específicas.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl mb-3 text-gray-900">Precios Accesibles</h3>
              <p className="text-gray-600">
                Ofrecemos planes de salud y opciones de pago flexibles para que todos puedan cuidar a sus mascotas.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
