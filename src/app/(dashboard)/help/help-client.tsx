"use client";

import { useState, useMemo } from "react";
import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  CreditCard,
  UserCog,
  Settings,
  Search,
  Shield,
  Upload,
  ChevronDown,
  ChevronRight,
  BookOpen,
  BarChart3,
  Lock,
  Wallet,
  LogIn,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  userRole: string;
}

interface HelpSection {
  id: string;
  title: string;
  icon: any;
  roles: string[];
  description: string;
  articles: HelpArticle[];
}

interface HelpArticle {
  title: string;
  roles?: string[];
  content: string[];
}

const helpSections: HelpSection[] = [
  {
    id: "auth",
    title: "Inicio de Sesion y Cuenta",
    icon: LogIn,
    roles: ["super_admin", "admin", "collaborator"],
    description: "Como acceder a la plataforma, configurar tu cuenta y opciones de seguridad.",
    articles: [
      {
        title: "Iniciar sesion",
        content: [
          "Puedes iniciar sesion de dos formas: con tu correo electronico y contrasena, o usando tu cuenta de Google.",
          "Si tienes la verificacion en dos pasos (2FA) activada, despues de ingresar tus credenciales deberas ingresar el codigo de 6 digitos de tu aplicacion de autenticacion o un codigo de respaldo.",
          "Si olvidaste tu contrasena, haz clic en 'Olvidaste tu contrasena?' en la pantalla de login. Recibiras un enlace por correo para restablecerla.",
        ],
      },
      {
        title: "Registrarse como nuevo usuario",
        content: [
          "Puedes crear una cuenta desde la pantalla de registro con tu nombre, correo y una contrasena (minimo 6 caracteres), o registrarte con Google.",
          "Despues de registrarte, un administrador debe asignarte a un Partner y asignarte un rol antes de que puedas acceder al sistema.",
          "Mientras esperas la aprobacion, veras una pantalla de 'Cuenta Pendiente de Aprobacion'.",
        ],
      },
      {
        title: "Vincular cuenta de Google",
        content: [
          "Ve a Configuracion > Perfil. En la seccion 'Cuenta vinculada' puedes vincular o desvincular tu cuenta de Google.",
          "Una vez vinculada, podras iniciar sesion con Google ademas de con tu correo y contrasena.",
        ],
      },
      {
        title: "Activar verificacion en dos pasos (2FA)",
        content: [
          "Ve a Configuracion > Perfil, en la seccion de Seguridad.",
          "Haz clic en 'Activar 2FA'. Se generara un codigo QR que deberas escanear con una aplicacion de autenticacion como Google Authenticator o Authy.",
          "Ingresa el codigo de 6 digitos que muestra tu aplicacion para confirmar la activacion.",
          "Se te proporcionaran codigos de respaldo. Guardalos en un lugar seguro — cada uno se puede usar una sola vez.",
          "Para desactivar 2FA, necesitaras ingresar un codigo valido de tu aplicacion.",
        ],
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    roles: ["super_admin", "admin", "collaborator"],
    description: "Vista principal con resumen de la actividad, ganancias y metricas.",
    articles: [
      {
        title: "Dashboard del administrador",
        roles: ["super_admin", "admin"],
        content: [
          "El dashboard muestra un resumen de la actividad financiera de tu organizacion.",
          "Las tarjetas superiores muestran: Ingresos del periodo, Pendiente de pago a colaboradores, y Total pagado en el periodo.",
          "Puedes cambiar el rango de fechas usando el selector de periodo (Este Mes, Mes Anterior, Trimestre, etc.) o un rango personalizado.",
          "Si eres Super Admin con multiples partners, puedes filtrar por partner.",
          "La grafica de tendencia muestra los ingresos en USD y MXN de los ultimos 12 meses.",
          "La seccion de 'Pagos Pendientes' muestra los 5 colaboradores con mas monto pendiente. Haz clic en cualquiera para ir a registrar su pago.",
          "Si hay usuarios registrados sin asignar a un partner, veras una alerta amarilla en la parte superior.",
        ],
      },
      {
        title: "Dashboard del colaborador",
        roles: ["collaborator"],
        content: [
          "Tu dashboard muestra un resumen de tus ganancias personales.",
          "Las tarjetas superiores muestran: tus ganancias del mes actual (USD y MXN), tu acumulado historico, numero de pagos recibidos y productos asignados.",
          "Si tienes pagos pendientes, veras una alerta indicando el monto de comisiones y extras pendientes.",
          "La grafica muestra la tendencia de tus ganancias de los ultimos 12 meses.",
          "En la seccion 'Mis Productos' puedes ver todos los productos donde tienes distribucion asignada con tu porcentaje.",
        ],
      },
    ],
  },
  {
    id: "reports",
    title: "Reportes",
    icon: FileText,
    roles: ["super_admin", "admin", "collaborator"],
    description: "Reportes mensuales de ganancias generados a partir de archivos CSV.",
    articles: [
      {
        title: "Ver reportes",
        content: [
          "La pagina de Reportes muestra todos los reportes mensuales generados.",
          "Puedes filtrar por ano y por partner (si tienes multiples).",
          "Cada reporte muestra: mes, partner, total USD, total MXN, tipo de cambio y estado (Congelado o Abierto).",
          "Haz clic en 'Ver' para acceder al detalle completo del reporte.",
          "Los colaboradores solo ven los reportes donde tienen lineas de ganancia.",
        ],
      },
      {
        title: "Subir un CSV para generar un reporte",
        roles: ["super_admin", "admin"],
        content: [
          "Para generar un nuevo reporte, ve a la pagina de Subir CSV (accesible desde Reportes).",
          "Paso 1: Selecciona el partner, el mes/ano del reporte, e ingresa el tipo de cambio USD a MXN.",
          "Paso 2: Arrastra o selecciona el archivo CSV de Microsoft Earnings.",
          "Paso 3: El sistema analiza el CSV y muestra un resumen de productos y transacciones encontrados.",
          "Paso 4: Verifica que los productos del CSV coincidan con los registrados en el sistema. Si hay productos nuevos, puedes registrarlos automaticamente.",
          "Paso 5: El sistema verifica si ya existe un reporte para ese mes. Si existe, puedes decidir si reemplazarlo.",
          "Paso 6: Haz clic en 'Generar Reporte' para procesar los datos. Se crearan las lineas de ganancia para cada colaborador segun sus distribuciones.",
        ],
      },
      {
        title: "Detalle de un reporte",
        content: [
          "El detalle muestra el desglose completo por colaborador: bruto, despues de impuestos, ajustes, neto USD y MXN.",
          "Cada colaborador muestra sus productos con el porcentaje aplicado y los montos correspondientes.",
          "Los administradores pueden agregar ajustes (bonos, deducciones, correcciones) mientras el reporte este abierto.",
          "Al congelar un reporte, se bloquean las ediciones. Los reportes congelados estan listos para pagarse.",
          "Puedes descargar el reporte en formato PDF o Excel.",
        ],
      },
      {
        title: "Ajustes en reportes",
        roles: ["super_admin", "admin"],
        content: [
          "Los ajustes permiten modificar las ganancias de un colaborador en un reporte especifico.",
          "Tipos de ajuste: Bono (suma al neto), Deduccion (resta del neto), Correccion (ajuste neutro).",
          "Para agregar un ajuste: abre el reporte, haz clic en 'Agregar Ajuste', selecciona el colaborador, tipo, monto y descripcion.",
          "Los ajustes solo se pueden hacer mientras el reporte este abierto (no congelado).",
          "Los ajustes aparecen reflejados en el desglose del colaborador y en el total del reporte.",
        ],
      },
    ],
  },
  {
    id: "products",
    title: "Productos",
    icon: Package,
    roles: ["super_admin", "admin", "collaborator"],
    description: "Gestion de productos digitales, distribuciones y ciclo de vida.",
    articles: [
      {
        title: "Lista de productos",
        content: [
          "La pagina de Productos muestra todos los productos registrados en el sistema.",
          "Los administradores ven todos los productos; los colaboradores solo ven aquellos donde tienen distribucion asignada.",
          "Puedes buscar por nombre, filtrar por tipo, estado y configuracion de distribucion.",
          "Las columnas de la tabla son personalizables — puedes elegir cuales mostrar.",
          "Para exportar la lista completa a Excel, usa el boton 'Exportar'.",
        ],
      },
      {
        title: "Crear un producto",
        roles: ["super_admin", "admin"],
        content: [
          "Haz clic en 'Nuevo Producto' en la parte superior.",
          "Ingresa: nombre del producto, selecciona el partner y el tipo de producto.",
          "Opcionalmente, agrega una descripcion.",
          "Despues de crear el producto, ve al detalle para configurar las distribuciones (quien gana que porcentaje).",
        ],
      },
      {
        title: "Distribuciones",
        roles: ["super_admin", "admin"],
        content: [
          "Las distribuciones definen que porcentaje de las ganancias de un producto le corresponde a cada colaborador.",
          "En el detalle del producto, en la pestana 'Distribuciones', puedes agregar colaboradores y asignarles un porcentaje.",
          "La suma de todos los porcentajes no debe exceder el 100%.",
          "Cuando se genera un reporte, el sistema calcula automaticamente las ganancias de cada colaborador segun su porcentaje.",
          "Puedes modificar los porcentajes en cualquier momento — los cambios aplican a reportes futuros.",
        ],
      },
      {
        title: "Ciclo de vida del producto",
        roles: ["super_admin", "admin"],
        content: [
          "Cada producto tiene un estado de ciclo de vida: Borrador, Activo o Descontinuado.",
          "Borrador: producto en preparacion, aun no genera ganancias.",
          "Activo: producto en produccion, genera ganancias normalmente.",
          "Descontinuado: producto retirado, no genera nuevas ganancias.",
          "Puedes cambiar el estado desde el detalle del producto.",
        ],
      },
    ],
  },
  {
    id: "collaborators",
    title: "Colaboradores",
    icon: Users,
    roles: ["super_admin", "admin"],
    description: "Gestion de usuarios, roles, asignaciones y perfiles virtuales.",
    articles: [
      {
        title: "Tipos de usuario",
        content: [
          "Existen dos tipos de usuario en el sistema:",
          "Usuario del Sistema: persona real con acceso a la plataforma. Requiere correo electronico y puede iniciar sesion.",
          "Perfil Virtual: entrada contable para personas que no necesitan acceso al sistema. Solo tienen nombre, sin login.",
        ],
      },
      {
        title: "Crear un colaborador",
        content: [
          "Haz clic en 'Nuevo' en la pagina de Colaboradores.",
          "Selecciona el tipo: Perfil Virtual o Usuario del Sistema.",
          "Ingresa el nombre (y correo si es usuario del sistema).",
          "Selecciona el partner y rol asignado.",
          "Si es usuario del sistema, recibira un correo de invitacion para configurar su contrasena.",
        ],
      },
      {
        title: "Roles y permisos",
        content: [
          "Existen tres roles en el sistema:",
          "Colaborador: ve sus propias ganancias, productos asignados y reportes donde participa.",
          "Admin: gestiona reportes, productos, colaboradores y pagos dentro de su(s) partner(s) asignado(s).",
          "Super Admin: acceso total a la plataforma, puede gestionar partners, ver todos los datos y administrar todos los usuarios.",
        ],
      },
      {
        title: "Asignar usuarios sin partner",
        content: [
          "Cuando un usuario se registra por su cuenta (sin invitacion), queda en estado 'pendiente' sin partner asignado.",
          "En la pagina de Colaboradores veras una alerta indicando cuantos usuarios estan sin asignar.",
          "Haz clic en la alerta para abrir el dialogo de asignacion, selecciona el usuario, partner y rol.",
        ],
      },
      {
        title: "Acciones masivas",
        content: [
          "Usa el boton 'Seleccionar' para entrar en modo de seleccion multiple.",
          "Marca los colaboradores que desees y usa los botones 'Activar' o 'Desactivar' para cambiar su estado en lote.",
          "Tambien puedes exportar la lista completa a Excel con el boton 'Exportar'.",
        ],
      },
    ],
  },
  {
    id: "payments",
    title: "Pagos",
    icon: CreditCard,
    roles: ["super_admin", "admin"],
    description: "Registro de pagos a colaboradores, conceptos extras y recibos.",
    articles: [
      {
        title: "Vista general de pagos",
        content: [
          "La pagina de Pagos muestra un resumen de todos los colaboradores con sus montos pendientes.",
          "Las tarjetas superiores muestran: total pendiente, numero de colaboradores con pagos pendientes, y total de colaboradores.",
          "Puedes buscar por nombre y filtrar por partner.",
          "Los colaboradores con 3 o mas meses sin pago se destacan con una alerta roja.",
        ],
      },
      {
        title: "Registrar un pago",
        content: [
          "Haz clic en un colaborador para ver su detalle de pagos.",
          "En el detalle veras sus comisiones pendientes (de reportes) y conceptos extras.",
          "Selecciona los items que deseas incluir en el pago usando los checkboxes.",
          "Haz clic en 'Registrar Pago'. Se abrira un dialogo para confirmar:",
          "- Total USD y MXN (calculado automaticamente)",
          "- Tipo de cambio (editable)",
          "- Metodo de pago (opcional, ej: 'Transferencia SPEI')",
          "- Notas (opcional)",
          "Al confirmar, se genera el registro de pago y un recibo descargable en PDF.",
        ],
      },
      {
        title: "Conceptos extras",
        content: [
          "Los conceptos extras son pagos adicionales fuera de las comisiones de reportes.",
          "Tipos: Comision (pago adicional), Trabajo (pago por servicio), Bono (incentivo), Deduccion (descuento).",
          "Para agregar un concepto: en el detalle del colaborador, haz clic en 'Agregar Concepto'.",
          "Ingresa: partner, tipo, descripcion, monto USD y fecha.",
          "Los conceptos pendientes aparecen en la lista de items seleccionables al registrar un pago.",
        ],
      },
      {
        title: "Pago masivo",
        content: [
          "Para pagar a varios colaboradores rapidamente, usa el boton 'Pago Masivo' en la pagina principal de Pagos.",
          "Selecciona los colaboradores que deseas pagar (solo se pueden seleccionar los que tienen monto pendiente).",
          "Haz clic en 'Registrar Pagos' para ir al detalle del primer seleccionado y registrar los pagos uno por uno.",
        ],
      },
      {
        title: "Recibos",
        content: [
          "Cada pago registrado genera automaticamente un recibo en PDF.",
          "El recibo incluye: datos del colaborador, desglose de items pagados, totales y metodo de pago.",
          "Puedes descargar recibos desde el historial de pagos del colaborador.",
          "Los colaboradores tambien pueden descargar sus recibos desde su dashboard.",
        ],
      },
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    icon: BarChart3,
    roles: ["super_admin", "admin"],
    description: "Graficas y metricas avanzadas de rendimiento financiero.",
    articles: [
      {
        title: "Pagina de analytics",
        content: [
          "Accede desde Reportes > Analytics para ver graficas detalladas.",
          "Las tarjetas muestran: Bruto, Neto, Pagado y Pendiente del ano seleccionado.",
          "Graficas disponibles:",
          "- Comparativa Mensual: barras de bruto vs neto por mes.",
          "- Distribucion por Partner: porcentaje de ingresos por partner (si hay multiples).",
          "- Tendencia de Pagos: area chart de pagado vs pendiente a lo largo del ano.",
          "- Ranking de Productos: los 15 productos con mas ingresos brutos.",
          "Puedes filtrar por ano y partner, y descargar un reporte fiscal del ano completo.",
        ],
      },
    ],
  },
  {
    id: "settings",
    title: "Configuracion",
    icon: UserCog,
    roles: ["super_admin", "admin", "collaborator"],
    description: "Perfil personal, seguridad, sesiones activas y Google.",
    articles: [
      {
        title: "Editar perfil",
        content: [
          "Ve a Configuracion > Perfil para editar tu nombre y foto de perfil.",
          "Haz clic en tu avatar para subir una nueva foto.",
          "Tu correo electronico no se puede cambiar desde aqui.",
          "Tu rol se muestra como referencia pero no es editable por ti mismo.",
        ],
      },
      {
        title: "Sesiones activas",
        content: [
          "En la seccion de Seguridad puedes ver todas las sesiones activas de tu cuenta.",
          "Cada sesion muestra: dispositivo, direccion IP y ultima actividad.",
          "Puedes cerrar sesiones individuales o todas las demas sesiones excepto la actual.",
        ],
      },
      {
        title: "Historial de accesos",
        content: [
          "Debajo de las sesiones activas veras un historial de intentos de inicio de sesion.",
          "Cada entrada muestra: fecha, correo, IP, y si fue exitoso o fallido.",
          "Si ves intentos fallidos que no reconoces, considera cambiar tu contrasena y activar 2FA.",
        ],
      },
    ],
  },
  {
    id: "admin",
    title: "Administracion",
    icon: Settings,
    roles: ["super_admin", "admin"],
    description: "Gestion de partners, impuestos y registro de actividad.",
    articles: [
      {
        title: "Gestionar Partners",
        roles: ["super_admin"],
        content: [
          "Ve a Configuracion > Administracion > Partners.",
          "Desde aqui puedes crear nuevos partners, editar su nombre y descripcion, y activar/desactivar partners.",
          "Haz clic en un partner para ver su detalle completo: miembros, productos, impuestos y actividad.",
        ],
      },
      {
        title: "Configurar impuestos de un partner",
        roles: ["super_admin"],
        content: [
          "En el detalle de un partner, la pestana 'Impuestos' permite configurar las retenciones que se aplican a las ganancias.",
          "Los impuestos se aplican en cascada segun su orden de prioridad.",
          "Puedes agregar, editar, reordenar, activar/desactivar y eliminar impuestos.",
          "Ejemplo: Si tienes ISR al 10% (prioridad 1) e IVA al 16% (prioridad 2), primero se aplica ISR sobre el bruto, luego IVA sobre el resultado.",
        ],
      },
      {
        title: "Registro de actividad (Audit Log)",
        content: [
          "El registro de actividad muestra todos los cambios realizados en el sistema: distribuciones, ajustes, impuestos, tipos de cambio, etc.",
          "Puedes filtrar por tipo de registro (tabla) y tipo de accion (creado, actualizado, eliminado).",
          "Cada entrada muestra quien hizo el cambio, cuando, y un detalle de los valores anteriores y nuevos.",
        ],
      },
    ],
  },
];

export function HelpClient({ userRole }: Props) {
  const [search, setSearch] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  const visibleSections = useMemo(() => {
    return helpSections.filter((s) => s.roles.includes(userRole));
  }, [userRole]);

  const filtered = useMemo(() => {
    if (!search) return visibleSections;
    const q = search.toLowerCase();
    return visibleSections
      .map((section) => {
        const matchedArticles = section.articles.filter((a) => {
          if (a.roles && !a.roles.includes(userRole)) return false;
          return (
            a.title.toLowerCase().includes(q) ||
            a.content.some((c) => c.toLowerCase().includes(q))
          );
        });
        if (
          section.title.toLowerCase().includes(q) ||
          section.description.toLowerCase().includes(q) ||
          matchedArticles.length > 0
        ) {
          return { ...section, articles: matchedArticles.length > 0 ? matchedArticles : section.articles };
        }
        return null;
      })
      .filter(Boolean) as HelpSection[];
  }, [search, visibleSections, userRole]);

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
    setExpandedArticle(null);
  };

  const toggleArticle = (key: string) => {
    setExpandedArticle((prev) => (prev === key ? null : key));
  };

  const roleLabel =
    userRole === "super_admin"
      ? "Super Admin"
      : userRole === "admin"
      ? "Administrador"
      : "Colaborador";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Centro de Ayuda
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Guias y documentacion de la plataforma BoxFi Partners.
          Viendo contenido para: <Badge variant="outline" className="ml-1">{roleLabel}</Badge>
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar en la documentacion..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-0 shadow-sm"
        />
      </div>

      {/* Sections */}
      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex h-[200px] items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Search className="mx-auto h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No se encontraron resultados para "{search}"</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((section) => {
            const isExpanded = expandedSection === section.id || !!search;
            const Icon = section.icon;
            const visibleArticles = section.articles.filter(
              (a) => !a.roles || a.roles.includes(userRole)
            );

            return (
              <Card key={section.id} className="border-0 shadow-sm overflow-hidden">
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="flex items-center gap-4 w-full p-5 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{section.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {section.description}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {visibleArticles.length} articulo{visibleArticles.length !== 1 ? "s" : ""}
                  </Badge>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {/* Articles list */}
                {isExpanded && (
                  <div className="border-t">
                    {visibleArticles.map((article, idx) => {
                      const articleKey = `${section.id}-${idx}`;
                      const isArticleOpen = expandedArticle === articleKey || (!!search && filtered.length <= 3);

                      return (
                        <div key={articleKey} className="border-b last:border-0">
                          <button
                            onClick={() => toggleArticle(articleKey)}
                            className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-muted/20 transition-colors"
                          >
                            {isArticleOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 text-primary shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span
                              className={cn(
                                "text-sm",
                                isArticleOpen
                                  ? "font-medium text-primary"
                                  : "text-foreground"
                              )}
                            >
                              {article.title}
                            </span>
                          </button>

                          {isArticleOpen && (
                            <div className="px-5 pb-4 pl-12 space-y-2">
                              {article.content.map((paragraph, pIdx) => (
                                <p
                                  key={pIdx}
                                  className={cn(
                                    "text-sm leading-relaxed",
                                    paragraph.startsWith("- ")
                                      ? "pl-4 text-muted-foreground"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {paragraph.startsWith("- ") ? (
                                    <>
                                      <span className="text-primary mr-1">*</span>
                                      {paragraph.substring(2)}
                                    </>
                                  ) : (
                                    paragraph
                                  )}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
