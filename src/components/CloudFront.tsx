import {
  BreadcrumbGroup,
  ContentLayout,
  Header,
  SpaceBetween,
  Container,
} from "@cloudscape-design/components";
import { AppLayout } from "./AppLayout";
import { SideNav } from "./SideNav";

function CloudFront() {
  return (
    <AppLayout
        breadcrumbs={
          <BreadcrumbGroup
            items={[
              { text: "Home", href: "/" },
              { text: "CloudFront", href: "/cloudfront" },
            ]}
          />
        }
        navigation={<SideNav activeHref="/cloudfront" />}
        content={
          <ContentLayout
            header={<Header variant="h1">CloudFront</Header>}
          >
            <SpaceBetween size="l">
              <Container>
                CloudFront tools and resources.
              </Container>
            </SpaceBetween>
          </ContentLayout>
        }
      />
  );
}

export default CloudFront;
