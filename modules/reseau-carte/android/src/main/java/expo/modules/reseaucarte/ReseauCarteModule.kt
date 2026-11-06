package expo.modules.reseaucarte

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import okhttp3.Dispatcher
import okhttp3.OkHttpClient
import org.maplibre.android.module.http.HttpRequestUtil

/**
 * Spec 23 (D99) : conditions d'OpenFreeMap pour les cartes hors ligne (lues le 2026-11-06) : au plus
 * 4 requêtes en parallèle et un User-Agent propre à l'app. MapLibre Android passe par OkHttp ; on lui donne
 * un client qui limite les requêtes par serveur et pose le User-Agent. Vaut pour toutes les cartes de l'app.
 */
class ReseauCarteModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReseauCarte")

    Function("configurer") { userAgent: String, requetesParServeur: Int ->
      val dispatcher = Dispatcher().apply {
        maxRequests = requetesParServeur
        maxRequestsPerHost = requetesParServeur
      }
      val client = OkHttpClient.Builder()
        .dispatcher(dispatcher)
        .addInterceptor { chain ->
          chain.proceed(chain.request().newBuilder().header("User-Agent", userAgent).build())
        }
        .build()
      HttpRequestUtil.setOkHttpClient(client)
      return@Function true
    }
  }
}
