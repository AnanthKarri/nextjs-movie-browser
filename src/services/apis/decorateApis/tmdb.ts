import { AxiosInstance } from "axios";
import {
  TmdbMovieEntity,
  TmdbPersonEntity,
  TmdbTvEntity
} from "../../../@types";

export interface TmdbDecorateAPI {
  movie: (
    id: number | string,
    { language, append }: { language: string; append?: string[] }
  ) => Promise<TmdbMovieEntity>;
  person: (
    id: number | string,
    { language, append }: { language: string; append?: string[] }
  ) => Promise<TmdbPersonEntity>;
  tv: (
    id: number | string,
    { language, append }: { language: string; append?: string[] }
  ) => Promise<TmdbTvEntity>;
}

const decorateApi = ({
  client /* key */
}: {
  client: AxiosInstance;
}): TmdbDecorateAPI => {
  client.defaults.params = {
    api_key: process.env.NEXTJS_APP_CLIENT_TMDB_API_KEY
  };
  return {
    movie: (id, { language, append = ["credits", "translations"] }) => {
      const query = `/movie/${id}`;
      return client
        .get(query, {
          params: {
            language: language || "en",
            append_to_response: append.join(",")
          }
        })
        .then(({ data }) => data);
    },
    person: (
      id,
      { language, append = ["movie_credits", "tv_credits", "translations"] }
    ) => {
      const query = `/person/${id}`;
      return client
        .get(query, {
          params: {
            language: language || "en",
            append_to_response: append.join(",")
          }
        })
        .then(({ data }) => data);
    },
    tv: (id, { language, append = ["credits", "translations"] }) => {
      const query = `/tv/${id}`;
      return client
        .get(query, {
          params: {
            language: language || "en",
            append_to_response: append.join(",")
          }
        })
        .then(({ data }) => data);
    }
  };
};

export default decorateApi;
