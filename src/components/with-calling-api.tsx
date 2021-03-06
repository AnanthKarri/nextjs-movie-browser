import { Component } from "react";
import { withRouter } from "next/router";
import { inject, observer } from "mobx-react";
import hoistNonReactStatics from "hoist-non-react-statics";

import Layout from "./Layout";
import Error from "./Error";
import { withNamespaces } from "../../i18n";
import {
  AppWithIdNextRootPageProps,
  AppWithIdNextRootPageGetInitialProps
} from "../@types";
import { getPathName } from "../utils/url";
import LinkHreflangTags from "./LinkHreflangTags";

type IPrepareCallApi = <C extends any, T>(
  props: C,
  apiCall: ({ language, id }: { language: string; id: string }) => Promise<T>
) => Promise<T>;

const prepareParamsAndCallApi: IPrepareCallApi = async (props, apiCall) => {
  const translationLanguageFullCode = props.translationLanguageFullCode;
  const defaultLanguageFullCode = props.defaultLanguageFullCode;
  const language = translationLanguageFullCode || defaultLanguageFullCode;
  console.log("callApi", language);
  const data = await apiCall({ language, id: props.query.id });
  return data;
};

/**
 * Decorator for NextJS pages that need to make an api request based on `query.id`
 *
 * Specify:
 * - apiCall: to be called to retrieve data based on id/language - optional (if not passed, data will be null)
 * - namespaces: will be injected in the `withNamespaces` decorator of the component
 * - namespacesRequired: will be returned by `getInitialProps` to prepare the translations needed
 */
const withCallingApi = <ApiEntity extends any>({
  apiCall,
  namespaces,
  namespacesRequired
}: {
  apiCall?: ({
    language,
    id
  }: {
    language: string;
    id: string;
  }) => Promise<ApiEntity>;
  namespaces: string;
  namespacesRequired: string[];
}) => (Comp: any) => {
  type IComponentProps = AppWithIdNextRootPageProps<ApiEntity | null>;

  interface IComponentState {
    data: ApiEntity | undefined | null;
  }

  type IGetInitialProps = AppWithIdNextRootPageGetInitialProps;

  /**
   * Lifecycle:
   *
   * Server-side:
   * - getInitialProps
   *   -> callApi
   * - constructor
   * - render
   *
   * Client-side
   * - constructor
   * - render
   * - componentDidMount
   * Change link
   * - getInitialProps
   *   -> callApi
   * - render
   * - componentDidUpdate
   */
  class PageWithId extends Component<IComponentProps, IComponentState> {
    state: IComponentState = {
      data: undefined
    };
    static displayName = `withCallingApi(${Comp.displayName ||
      Comp.name ||
      "Component"})`;
    static async getInitialProps(
      props: IGetInitialProps
    ): Promise<{
      data: ApiEntity | null;
      namespacesRequired: string[];
    }> {
      console.log(`${PageWithId.displayName}.getInitialProps`);
      let data = null;
      if (typeof apiCall !== "undefined") {
        data = await prepareParamsAndCallApi(props, ({ language, id }) =>
          apiCall({ id, language })
        );
      }
      // store injected from _app.tsx, used in ssr
      const translationsStore =
        props.mobxStore && props.mobxStore.translationsStore;
      if (translationsStore) {
        translationsStore.setTranslations(
          (data && data.translations && data.translations.translations) || []
        );
      }
      return {
        data,
        namespacesRequired
      };
    }
    constructor(props: IComponentProps) {
      super(props);
      console.log(`${PageWithId.displayName}.constructor`);
      // store data from getInitialProps into state to be able to trigger a change when detecting language change
      this.state.data = props.data;
    }
    /**
     * Sets data in state fallbacking with proper language for fields alike to be translated
     * like `overview`, `title`, `biography` ...
     */
    setStateData(data: ApiEntity) {
      console.log(`${PageWithId.displayName}.setStateData`);
      const translatedData = this.props.translationsStore.retrieveDataWithFallback(
        data,
        this.props.defaultLanguageFullCode,
        this.props.translationLanguageFullCode
      );
      this.setState({ data: translatedData });
    }
    componentDidMount() {
      console.log(`${PageWithId.displayName}.componentDidMount`);
      this.props.translationsStore.setTranslations(
        (this.props.data &&
          this.props.data.translations &&
          this.props.data.translations.translations) ||
          []
      );
      if (this.props.data) {
        this.setStateData(this.props.data);
      }
    }
    componentDidUpdate(prevProps: IComponentProps) {
      console.log(`${PageWithId.displayName}.componentDidUpdate`);
      // update translations client side when change from getInitialProps
      this.props.translationsStore.setTranslations(
        (this.props.data &&
          this.props.data.translations &&
          this.props.data.translations.translations) ||
          []
      );
      // just after first load (from ssr), ensure state is updated if data provided by getInitialProps changes
      if (
        prevProps.data &&
        this.props.data &&
        prevProps.data.id !== this.props.data.id
      ) {
        this.setStateData(this.props.data);
      }
      // re-call api with different language when it changes
      if (
        this.props.data &&
        typeof apiCall !== "undefined" &&
        (prevProps.translationLanguageFullCode !==
          this.props.translationLanguageFullCode ||
          prevProps.defaultLanguageFullCode !==
            this.props.defaultLanguageFullCode)
      ) {
        this.props.uiStore.setLoadingState({ loading: true });
        prepareParamsAndCallApi(
          { ...this.props, query: { id: this.props.data.id } },
          ({ language, id }) => apiCall({ id, language })
        )
          .then(data => {
            this.setStateData(data);
            this.props.uiStore.setLoadingState({ loading: false });
          })
          .catch(() => {
            this.setState({ data: undefined });
            this.props.uiStore.setLoadingState({ loading: false });
          });
      }
    }
    render() {
      console.log(`${PageWithId.displayName}.render`);
      return (
        <Layout
          currentUrl={`${this.props.basePath}${getPathName(this.props.router)}`}
        >
          <LinkHreflangTags
            url={`${this.props.basePath}${getPathName(this.props.router)}`}
            translationFullCodes={
              this.props.translationsStore.availableLanguagesCodes
            }
          />
          {!this.state.data && typeof apiCall !== "undefined" ? (
            <Error />
          ) : (
            <Comp
              data={this.state.data}
              basePath={this.props.basePath}
              pathname={getPathName(this.props.router)}
            />
          )}
        </Layout>
      );
    }
  }

  return withNamespaces(namespaces)(
    inject("translationsStore", "uiStore")(
      observer(withRouter(hoistNonReactStatics(PageWithId, Comp)))
    )
  );
};

export default withCallingApi;
